import os

DIR = os.path.dirname(os.path.abspath(__file__))

def update_blog(txt_file, html_file, folder):
    with open(txt_file, 'r') as f:
        lines = f.readlines()
    folder = folder.replace("_", " ").title()

    html_content = \
        f"""<!DOCTYPE html>
<html>
<head>
    <title>{folder}</title>
    <link rel="stylesheet" href="../style.css">
</head>

<body>
    <div id="container">
        <header>
            <h1>{folder}</h1>
            <nav>
                <ul>
                    <li><a href="../index.html">Domov</a></li>
                    <li><a href="https://www.youtube.com/@ckona99/videos">YouTube</a></li>
                    <li><a href="https://www.strava.com/athletes/27671661">Strava</a></li>
                </ul>
            </nav>
        </header>
"""

    for line in lines:
        line = line.strip()
        if line.startswith("HEADING:"):
            heading = line.split("HEADING:")[1].strip()
            html_content += f'\n        <div id="slika">\n            <h1>{heading}</h1>\n'
        elif line.startswith("IMAGE:"):
            image_path = line.split("IMAGE:")[1].strip()
            html_content += f'            <img src="images/{image_path}" alt="{heading}">\n'
        elif line.startswith("TEXT:"):
            text = line.split("TEXT:")[1].strip()
            html_content += f"            <p>{text}</p>\n        </div>\n"

    html_content += "    </div>\n</body>\n</html>"

    with open(html_file, 'w') as f:
        f.write(html_content)

def update_main_page():
    # find all folders in the blog directory
    folders = [f for f in os.listdir(DIR) if os.path.isdir(os.path.join(DIR, f))]
    # find one image from each folder
    folder_images = {}
    for folder in folders:
        images = [f for f in os.listdir(os.path.join(DIR, folder, 'images')) if f.endswith('.JPG')]
        folder_images[folder] = images[0]


    blog_htmls = f"""<div>
            <h2><a href="{folders[0]}/index.html">{folders[0].replace('_', ' ').title()}</a></h2>
            <img id="home_img" src="{folders[0]}/images/{folder_images[folder]}" alt="{folders[0]}">
        </div>
"""

    html_content = \
        f"""<!DOCTYPE html>
<html>
<head>
    <title>Bikepacking Velebit</title>
    <link rel="stylesheet" href="style.css">
</head>

<body>
    <div id="container">
        <header>
            <h1>Moje slikce</h1>
            <nav>
                <ul>
                    <li><a href="index.html">Domov</a></li>
                    <li><a href="https://www.youtube.com/@ckona99/videos">YouTube</a></li>
                    <li><a href="https://www.strava.com/athletes/27671661">Strava</a></li>
                </ul>
            </nav>
        </header>

        {blog_htmls}

    </div>
</body>
</html>"""

    with open(os.path.join(DIR, 'index.html'), 'w') as f:
        f.write(html_content)


if __name__ == '__main__':
    folder = "bikepacking_velebit"
    txt_file = os.path.join(DIR, folder, 'template.txt')
    html_file = os.path.join(DIR, folder, 'index.html')
    update_blog(txt_file, html_file, folder)
    update_main_page()