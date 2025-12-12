import base64
import os
import argparse
from datetime import datetime
from backend.paths import *
from aiohttp import web
from aiohttp.web_middlewares import normalize_path_middleware
from tinydb import TinyDB, Query
from urllib.parse import urlparse
import pathlib

# Import clustering
from backend.clustering.clustering import return_json_tree, return_json_tsne

# Images utils
from backend.utils_image import get_image_filename, image_exists, save_resized_images

# ------------------------------------------------------------
# Import des agents
from backend.agents.cmaes.agent_cmaes import AgentCMAES
from backend.agents.gaussian.agent_gaussian import AgentGaussian
from backend.agents.simple.agent_simple import AgentRandom
from backend.agents.open_ended.agent_open_ended import AgentOpenEnded

# ------------------------------------------------------------
PORT_SERVER = 3001
IP_SERVER = f"127.0.0.1"
URL_SERVER = f"http://{IP_SERVER}:{PORT_SERVER}"
CLIENT_MAX_SIZE = 50 * 1024**2  # 50 MB input for server
BASE_DIR_SERVER = pathlib.Path(".").resolve()   # server root
FOLDER_EXCEPTIONS_SERVER = {
    "",
    "examples"
}
# ------------------------------------------------------------
mapping_agent_name_to_class = {
    "random": AgentRandom,
    "cma-es": AgentCMAES,
    "gaussian": AgentGaussian,
    "open-ended": AgentOpenEnded,
}

import logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ------------------------------------------------------------
# Global dictionary to store agents per session
SESSIONS_AGENTS = {}  # dictionnary (session_id, agent_name) -> object agent

# ------------------------------------------------------------
def open_db(session_id):
    path_db = f"{PATH_IMAGES}/{session_id}/tinydb.json"
    os.makedirs(os.path.dirname(path_db), exist_ok=True)
    return TinyDB(path_db)


def get_or_create_agent(session_id, agent_name, param_defs, force_new=False):
    key = (session_id, agent_name)
    if (key in SESSIONS_AGENTS) and (not force_new):
        return SESSIONS_AGENTS[key]

    if agent_name not in mapping_agent_name_to_class:
        raise ValueError(f"Unknown agent name: {agent_name}")
    AgentClass = mapping_agent_name_to_class[agent_name]
    agent = AgentClass(param_defs)
    SESSIONS_AGENTS[key] = agent
    return agent


async def handle_agent_update(request: web.Request):
    # retrieves the json, then the agent name, retrieves (or creates) the agent if needed, and calls its update
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )

    session_id  = data.get("session_id")
    agent_name  = data.get("agent_name")
    params      = data.get("parameters") or {}
    metadata    = data.get("metadata") or {}
    score       = data.get("score")
    param_defs  = data.get("parameters_def")
    if session_id is None:
        return web.json_response({"status": "error", "message": "session_id not set"}, status=400)

    if agent_name is None:
        return web.json_response({"status": "error", "message": "agent_name not set"}, status=400)

    agent = get_or_create_agent(session_id, agent_name, param_defs)
    agent.update(params, score, metadata)
    return web.json_response({"status": "ok"})

async def handle_agent_change(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )
    session_id = data.get("session_id")
    agent_name = data.get("agent_name")
    param_defs = data.get("parameters_def")
    if session_id is None:
        return web.json_response({"status": "error", "message": "session_id not set"}, status=400)
    if agent_name is None:
        return web.json_response({"status": "error", "message": "agent_name not set"}, status=400)
    
    get_or_create_agent(session_id, agent_name, param_defs, force_new=True)
    return web.json_response({"status": "ok"})

async def handle_agent_play(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )
    session_id = data.get("session_id")
    agent_name = data.get("agent_name")
    param_defs = data.get("parameters_def") or {}
    if session_id is None:
        return web.json_response({"status": "error", "message": "session_id not set"}, status=400)
    if agent_name is None:
        return web.json_response({"status": "error", "message": "agent_name not set"}, status=400)
    
    agent = get_or_create_agent(session_id, agent_name, param_defs)
    params_out, metadata = agent.play()
    return web.json_response(
        {
            "status": "ok",
            "parameters": params_out,
            "metadata": metadata,
        }
    )

async def handle_agent_time_warp(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )

    session_id = data.get("session_id")
    agent_name = data.get("agent_name")
    param_defs = data.get("parameters_def") or {}
    n_steps = data.get("n_steps")

    if session_id is None:
        return web.json_response(
            {"status": "error", "message": "session_id not set"}, status=400
        )

    if agent_name is None:
        return web.json_response(
            {"status": "error", "message": "agent_name not set"}, status=400
        )

    if n_steps is None:
        return web.json_response(
            {"status": "error", "message": "n_steps not set"}, status=400
        )

    try:
        n_steps = int(n_steps)
    except (TypeError, ValueError):
        return web.json_response(
            {"status": "error", "message": "n_steps must be an integer"}, status=400
        )

    agent = get_or_create_agent(session_id, agent_name, param_defs)

    try:
        agent.time_warp(n_steps)
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"time_warp failed: {e}"}, status=500
        )

    return web.json_response({"status": "ok"})



# ------------------------------------------------------------
async def handle_save(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )

    try:
        # user id du param explorer
        pe_id = data.get("id")
        # session en cours
        session_id = data.get("session_id")
    except Exception as e:
        return web.json_response(
            {
                "status": "error",
                "message": f"param explorer id not set OR session_id not set",
            },
            status=400,
        )

    # list of parameters

          
    batch_parameters = data.get("batch_parameters", [])
    batch_metadata = data.get("batch_metadata", [[] for _ in batch_parameters])
    if not isinstance(batch_parameters, list):
        return web.json_response(
            {"status": "error", "message": "'batch_parameters' must be a list"},
            status=400,
        )

    # dir pour les images
    path_images = os.path.join(PATH_IMAGES, f"{session_id}")
    os.makedirs(os.path.dirname(path_images), exist_ok=True)

    images_ids = []
    # Parcours de tous les parameters
    for i, parameter_metadata in enumerate(zip(batch_parameters, batch_metadata)):
        parameter, metadata = parameter_metadata
        if "image_data" not in parameter or "image_timestamp" not in parameter:
            continue

        # Sauvegarde de l'image
        # {id}_image_{timestamp_str}_score_{score}.{ext}

        b64_data = parameter.get("image_data")
        timestamp_str = str(parameter.get("image_timestamp"))
        score = parameter.get("score")
        ext = "jpg"

        try:
            image_bytes = base64.b64decode(b64_data)
            #filename = f"{pe_id}_image_{timestamp_str}.{ext}"
            filename = get_image_filename(pe_id,timestamp_str,ext)
            filepath = os.path.join(path_images, filename)
            image_url = f"{URL_SERVER}/{PATH_IMAGES}/{session_id}/{filename}"

            # Save image
            with open(filepath, "wb") as f:
                f.write(image_bytes)

            # Save resized images
            save_resized_images(image_bytes,pe_id,timestamp_str,ext,path_images)

            # Update the item: remove "image", add "image_url"
            parameter_updated = dict(parameter)
            parameter_updated.pop("score", None)
            parameter_updated.pop("image_data", None)
            parameter_updated.pop("image_timestamp", None)
            # parameter_updated["image_url"] = image_url

            db = open_db(session_id)
            image_id = db.insert(
                {
                    "parameters": parameter_updated,
                    "metadata": metadata,
                    "url": image_url,
                    "score": score,
                    "timestamp": timestamp_str,
                }
            )
            # print(f"image id={image_id}")
            images_ids.append(image_id)

        except Exception as e:
            print(f"❌ error on image {i}: {e}")

    # Return exactly the same format as before
    return web.json_response({"status": "ok", "images_ids": images_ids})


# ------------------------------------------------------------
async def handle_load_gallery(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )

    # Already handled earlier - this is the load_gallery function
    # Retrieve the session
    try:
        session_id = data.get("session_id")
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"session_id not set : {e}"}, status=400
        )

    # Retrieve the filter
    filter_id = data.get("filter_id", 0)  # 0 = timestamp ASC (see uiViewGallery.js)
    # print(f"handle_load_gallery, filter_id={filter_id}")

    # Database connection
    db = open_db(session_id)

    imagesInfos = []

    try:
        docs = None
        array_docs = []
        if filter_id == 0:
            docs = db.all()
            docs.sort(key=lambda d: int(d.get("timestamp", 0)), reverse=True)
            array_docs = [docs]
        elif filter_id == 1:
            Image = Query()
            docs = db.search(Image.score == -1)
            docs.sort(key=lambda d: int(d.get("timestamp", 0)), reverse=True)
            array_docs = [docs]
        elif filter_id == 2:
            Image = Query()
            score_min = data.get("score_min", 0)
            docs = db.search(Image.score >= score_min)
            # print("Search results:", docs)
            docs = sorted(docs, key=lambda d: (d.get("score",0), d.get("timestamp",0)), reverse=True)
            array_docs = [docs]

        elif filter_id == 3:
            Image = Query()
            agent_name = data.get("agent_name", "")
            agent_max_pop_idx = data.get("agent_max_pop_idx", -1)
            docs_all = db.search(Image.metadata.agent_name == agent_name)
            pop_idx_to_docs = {}
            for doc in docs_all:
                pop_idx = doc.get("metadata", {}).get("pop_idx", -1)
                score = doc.get("score", -1)
                # TODO: is it necessary to filter by score here? It seems so.
                if score < 70:
                    continue
                if pop_idx not in pop_idx_to_docs:
                    pop_idx_to_docs[pop_idx] = []
                pop_idx_to_docs[pop_idx].append(doc)
            docs = []
            for pop_idx, docs_list in pop_idx_to_docs.items():
                docs_list.sort(key=lambda d: int(d.get("timestamp", 0)), reverse=True)
                array_docs.append(docs_list[:agent_max_pop_idx])
        else:
            docs = db.all()  # should not be here
            array_docs = [docs]

    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"TinyDB error: {e}"}, status=500
        )
    

    ArrayImagesInfos = []
    for docs_list in array_docs:
        imagesInfos = []
        for doc in docs_list:
            imagesInfos.append(
                {
                    "id": doc.doc_id,
                    "url": doc.get("url"),
                "score": doc.get("score"),
                "metadata" : doc.get("metadata"),
                "timestamp": doc.get("timestamp", 0),
            }
        )
        ArrayImagesInfos.append(imagesInfos)

    return web.json_response({"status": "ok", "imagesInfos": ArrayImagesInfos})

# ------------------------------------------------------------
async def handle_load_image_data(request : web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response({"status": "error", "message": f"invalid JSON: {e}"}, status=400)
    try:
        session_id = data.get("session_id")
    except Exception as e:
        return web.json_response({"status": "error", "message": f"session_id not set : {e}"}, status=400)
    try:
        image_id = data.get("image_id")
    except Exception as e:
        return web.json_response({"status": "error", "message": f"image_id not set : {e}"}, status=400)
    
    print(data)
    # Open database
    db = open_db(session_id)
    result = db.get(doc_id=int(image_id))
    if result is not None : 
        imageInfos = {
            "id": result.doc_id,
            "score": result.get("score"),
            "parameters": result.get("parameters"),
            "metadata": result.get("metadata", {}),
            "timestamp": result.get("timestamp", 0),
        }
        return web.json_response({"status": "ok", "imageInfos": imageInfos})
    
    return web.json_response({"status": "error", "message": f"image with id={image_id} not found"})

# ------------------------------------------------------------
async def handle_load_data(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )
    try:
        session_id = data.get("session_id")
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"session_id not set : {e}"}, status=400
        )

    # Open database
    db = open_db(session_id)
    # Query score != -1
    Image = Query()
    results = db.search(Image.score != -1)
    # Stack objects with pertinent infos
    imagesInfos = []
    for doc in results:
        imagesInfos.append(
            {
                "id": doc.doc_id,
                "score": doc.get("score"),
                "parameters": doc.get("parameters"),
                "metadata": doc.get("metadata", {}),
                "timestamp": doc.get("timestamp", 0),
            }
        )
    return web.json_response({"status": "ok", "imagesInfos": imagesInfos})


# ------------------------------------------------------------
async def handle_update_score(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )

    # Retrieve the session
    try:
        session_id = data.get("session_id")
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"session_id not set : {e}"}, status=400
        )

    try:
        image_id = data.get("image_id")
        score = data.get("score")
    except Exception as e:
        return web.json_response(
            {
                "status": "error",
                "message": f"cannot find image_id or score in data : {e}",
            },
            status=400,
        )

    # Database connection
    db = open_db(session_id)

    result = db.update({"score": score}, doc_ids=[int(image_id)])
    image_infos = db.get(doc_id=int(image_id))
    # print("Updated image infos:", image_infos)
    if result:
        return web.json_response({"status": "ok", "image_infos": image_infos})

    return web.json_response(
        {"status": "error", "message": "no entry found"}, status=400
    )


# ------------------------------------------------------------
async def handle_delete_image(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )

    # Retrieve the session
    session_id = data.get("session_id")
    image_id = data.get("id") or data.get("image_id")

    if session_id is None or image_id is None:
        return web.json_response(
            {"status": "error", "message": "session_id or image_id missing"}, status=400
        )

    try:
        image_id = int(image_id)
    except Exception:
        return web.json_response(
            {"status": "error", "message": "image_id must be an integer"}, status=400
        )

    # Database connection
    db = open_db(session_id)

    # Retrieve the doc to find the URL/file
    doc = db.get(doc_id=image_id)
    if doc is None:
        return web.json_response(
            {"status": "error", "message": f"no entry with id={image_id}"}, status=404
        )

    # Delete the corresponding image file, if possible
    url = doc.get("url")
    if url:
        try:
            parsed = urlparse(url)
            # ex: /images/<session_id>/<filename>
            rel_path = parsed.path.lstrip("/")  # "images/..."
            filepath = os.path.join(rel_path)  # relatif au cwd

            if os.path.exists(filepath):
                os.remove(filepath)
                print(f"Deleted image file: {filepath}")
            else:
                print(f"Image file not found for deletion: {filepath}")
        except Exception as e:
            print(f"Error while deleting file for image {image_id}: {e}")

    # Delete the DB entry
    try:
        db.remove(doc_ids=[image_id])
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"TinyDB remove error: {e}"}, status=500
        )

    return web.json_response({"status": "ok", "deleted_id": image_id})

async def handle_compute_dendrogram(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )
    session_id = data.get("session_id")
    json_path = "data/images/{}/tinydb.json".format(session_id)

    json_tree = return_json_tree(
        json_path = json_path,
        agent_name ="cma-es",
        score_min = 90,
        timestamp_threshold = 0.0)
    return web.json_response({"status": "ok", "tree": json_tree})

async def handle_compute_tsne(request: web.Request):
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response(
            {"status": "error", "message": f"invalid JSON: {e}"}, status=400
        )
    session_id = data.get("session_id")
    json_path = "data/images/{}/tinydb.json".format(session_id)

    json_tsne = return_json_tsne(
        json_path = json_path,
        agent_name ="cma-es",
        score_min = 90
        )
    return web.json_response({"status": "ok", "tsne": json_tsne})

# ------------------------------------------------------------
async def file_handler(request):
    # Requested path
    rel_path = request.match_info["path"]
    requested = (BASE_DIR_SERVER / rel_path).resolve()

    # Security: do not leave the root folder
    if BASE_DIR_SERVER not in requested.parents and requested != BASE_DIR_SERVER:
        raise web.HTTPForbidden()

    # If it's a folder → serve index.html inside
    if requested.is_dir():
        index_file = requested / "index.html"
        if index_file.exists():
            return web.FileResponse(index_file)

    # Si c’est un fichier existant → le servir
    if requested.exists() and requested.is_file():
        return web.FileResponse(requested)

    raise web.HTTPNotFound()

# ------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--host", default=IP_SERVER, help="Host for HTTP server (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=PORT_SERVER,
        help=f"Port for HTTP server (default: {PORT_SERVER})",
    )

    os.makedirs(PATH_IMAGES, exist_ok=True)

    dir_home = os.getcwd()

    app = web.Application(
        middlewares=[normalize_path_middleware(merge_slashes=True)],
        client_max_size=CLIENT_MAX_SIZE,
    )

    app.router.add_get("/{path:.*}", file_handler)    

    app.router.add_static("/", dir_home, show_index=True)
    app.router.add_post("/save", handle_save)
    app.router.add_post("/load_gallery", handle_load_gallery)
    app.router.add_post("/load_image_data", handle_load_image_data)
    app.router.add_post("/load_data", handle_load_data)
    app.router.add_post("/update_score", handle_update_score)
    app.router.add_post("/delete_image", handle_delete_image)

    app.router.add_post("/agent/play", handle_agent_play)
    app.router.add_post("/agent/update", handle_agent_update)
    app.router.add_post("/agent/change", handle_agent_change)
    app.router.add_post("/agent/time_warp", handle_agent_time_warp)

    app.router.add_post("/clustering/plot_dendrogram", handle_compute_dendrogram)
    app.router.add_post("/clustering/plot_tsne", handle_compute_tsne)

    args = parser.parse_args()
    ssl_context = None
    web.run_app(
        app, access_log=None, host=args.host, port=args.port, ssl_context=ssl_context
    )
