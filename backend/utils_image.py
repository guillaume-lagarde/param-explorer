import os
from PIL import Image
from io import BytesIO

# ------------------------------------------------------------
IMAGE_RESIZE_TARGET_WIDTHS = [256, 512, 1024]

# ------------------------------------------------------------
def image_exists(pe_id, timestamp_str, ext, path_images, width=None):
    # Generate the expected filename
    filename = get_image_filename(pe_id, timestamp_str, ext, width)

    # Build the full path
    filepath = os.path.join(path_images, filename)

    # Check if the file exists
    return os.path.isfile(filepath)

# ------------------------------------------------------------
def get_image_filename(pe_id,timestamp_str,ext,width=None):
    filename = f"{pe_id}_image_{timestamp_str}"
    if width is not None and width in IMAGE_RESIZE_TARGET_WIDTHS:
        filename += f"_w{width}"
    return f"{filename}.{ext}"

# ------------------------------------------------------------
def save_resized_images(image_bytes, pe_id, timestamp_str, ext, path_images):
    # Decode the image
    original_img = Image.open(BytesIO(image_bytes))

    saved_files = []

    for width in IMAGE_RESIZE_TARGET_WIDTHS:
        # Calculate ratio to preserve proportions
        ratio = width / original_img.width
        height = int(original_img.height * ratio)

        # Resize
        resized_img = original_img.resize((width, height), Image.LANCZOS)

        # New filename
        filepath = os.path.join(path_images, get_image_filename(pe_id,timestamp_str,ext,width))

        # Save
        resized_img.save(filepath)
        saved_files.append(filepath)

    return saved_files

