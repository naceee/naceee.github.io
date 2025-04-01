import os
import pandas as pd
import re

DIR = os.path.dirname(os.path.abspath(__file__))


def prepare_data_dict():
    df = pd.read_csv(os.path.join(DIR, 'data/totals.csv'), index_col=0)
    data_dict = {}
    players = df.index
    points = df["points"]
    data_dict["all_time_scores"] = [{"player": player, "value": value} for player, value in zip(players, points)]

    df_places = pd.read_csv(os.path.join(DIR, 'data/number_of_places.csv'))
    data_dict["win_percentage"] = [{"player": player, "value": df_places[player][0]} for player in df_places.columns]

    data_dict["number_wins"] = [{"player": player, "value": 69} for player, value in zip(players, points)]

    for key, value in data_dict.items():
        data_dict[key] = sorted(value, key=lambda x: x["value"], reverse=True)
    return data_dict


def template_to_html():
    with open(f'{DIR}/texts/header.txt', 'r', encoding='utf-8') as f:
        html = f.read()

    with open(f'{DIR}/texts/template.txt', 'r') as f:
        template = f.read()
    html = html + template

    data_dict = prepare_data_dict()

    matches = re.findall(r'\{(.*?)\}', html)

    for match in matches:
        if match.count(":") == 2:
            m_type, m_value, m_caption = match.split(':')
        else:
            m_type, m_value = match.split(':')
            m_caption = m_type

        if m_type == "GRAPH":
            text = f'<figure>\n' \
                   f'<img src="graphs/{m_value}.png">\n' \
                   f'<figcaption> {m_caption} </figcaption>\n' \
                   f'</figure>\n'

            html = html.replace(f"{{{match}}}", text)


        elif m_type == "TABLE":
            # read the full text file
            with open(f'{DIR}/texts/{m_value}.txt', 'r') as f:
                text = f.read()
            text = f'<table class="borders-custom col-1-l col-2-r col-3-r col-4-r col-5-r">\n' \
                   f'{text}\n' \
                   f'<caption> {m_caption} </caption>' \
                   f'</table>\n'


            html = html.replace(f"{{{match}}}", text)

        elif m_type == "DATA":
            dict_path = m_value.split(',')
            dd = data_dict.copy()
            for d in dict_path:
                print(d, dd)
                try:
                    dd = dd[d]
                except:
                    dd = dd[int(d)]


            html = html.replace(f"{{{match}}}", str(dd))


    with open(f'{DIR}/texts/footer.txt', 'r', encoding='utf-8') as f:
        footer = f.read()
    html += footer

    # write to file
    with open(f'{DIR}/index.html', 'w') as f:
        f.write(html)


if __name__ == '__main__':
    template_to_html()
