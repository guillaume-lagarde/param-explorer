async function call(end_point,data={})
{
    let response    = await fetch(`${URL_SERVER}/${end_point}`,{method:'POST', body:JSON.stringify(data)});
    let json        = await response.json();
    if (json.status == 'error') console.warn(json);
    return json;
}
