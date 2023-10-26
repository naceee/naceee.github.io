def main():
    # read the txt file line by line
    with open('template.txt', 'r') as f:
        lines = f.readlines()

    html = ""

    for line in lines:
        line = line.strip()
        split_line = line.split(" ")
        if split_line[0] == "GRAPH:":
            html += '<div>\n'
            html += f'<iframe src="graphs/{split_line[1]}.html" width="100%" ' \
                    f'height="650px"></iframe>\n'
            html += '</div>\n'

        elif split_line[0] == "TEXT:":
            # read the full text file
            with open(f"texts/{split_line[1]}.txt", 'r') as f:
                text = f.read()

            html += '<div>\n'
            html += text + "\n"
            html += '</div>\n'

        else:
            html += line + "\n"

    # write to file
    with open('stats.html', 'w') as f:
        f.write(html)


if __name__ == '__main__':
    main()
