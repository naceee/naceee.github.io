import json

import pandas as pd
import plotly.graph_objects as go
from plotly.colors import n_colors
import numpy as np
import matplotlib
import os
from PIL import Image, ImageDraw
from graph import Graph

DIR = os.path.dirname(os.path.abspath(__file__))

game_data = pd.read_csv(f'{DIR}/data/games_data_merge_players.csv')
PLAYERS = list(game_data.columns[1:])
cmap = matplotlib.colormaps['Set2']
COLORS = {PLAYERS[i]: f"rgb{(cmap(i)[0], cmap(i)[1], cmap(i)[2])}" for i in range(len(PLAYERS))}


def get_update_layout():
    return dict(
        plot_bgcolor="white",
        xaxis={'visible': False},
        yaxis={'visible': False},
        showlegend=False,
        margin=dict(r=20, t=20, b=20, l=20)
    )


def all_time_leaderboard():
    data = pd.read_csv(f'{DIR}/data/leaderboard_cumsum.csv')
    # plot the data using plotly
    g = Graph()
    for player in PLAYERS:
        x = data[f"{player}_games"]
        y = data[player]
        g.fig.add_trace(go.Scatter(x=x, y=y, mode='lines', name=player,
                                   line=dict(color=COLORS[player])))

    end_scores = data.iloc[-1]
    end_scores = end_scores.sort_values(ascending=False)
    y_positions = end_scores  # arrange_positions(end_scores)

    # add the end score to the plot
    g.add_annotations(
        [[data[f"{player}_games"].iloc[-1], y_positions[player],
          f"{player} {int(end_scores[player])}", COLORS[player]] for player in PLAYERS],
        xanchor="left"
    )
    g.update_layout()
    g.show_and_save("all_time_leaderboard")


def last_n_leaderboard():
    data = pd.read_csv(f'{DIR}/data/last_n_games.csv')

    # plot the data using plotly
    g = Graph()
    for player in PLAYERS:
        x = data["st_iger"]
        y = data[player]
        g.fig.add_trace(go.Scatter(x=x, y=y, mode='lines', name=player,
                                   line=dict(color=COLORS[player])))

    # compute the end score for each player
    end_scores = data.iloc[-1]
    # sort the players by their end score
    end_scores = end_scores.sort_values(ascending=False)
    y_positions = arrange_positions(end_scores)

    # add the end score to the plot
    g.add_annotations(
        [[list(data["st_iger"])[-1], y_positions[player], f"{player} {int(end_scores[player])}",
          COLORS[player]] for player in PLAYERS],
        xanchor="left"
    )
    g.update_layout()
    g.show_and_save("last_n_leaderboard")


def arrange_positions(end_scores, k=0.04):
    # sort the players by their end score
    end_scores = end_scores.sort_values(ascending=False)
    last_y = 0
    y_positions_dict = {}
    max_y = max(end_scores)
    for player in end_scores.index:
        if last_y == 0:
            last_y = max_y
        else:
            if last_y - end_scores[player] < k * max_y:
                last_y = last_y - k * max_y
            else:
                last_y = end_scores[player]

        y_positions_dict[player] = last_y
    return y_positions_dict


def number_of_places():
    data = pd.read_csv(f'{DIR}/data/number_of_places.csv')
    sorted_players = list(data.columns)
    games_played = pd.read_csv(f'{DIR}/data/num_played_games.csv')

    colors = ["gold", "silver", "peru", "#edebe1"]

    g = Graph(margins=dict(r=20, t=20, b=70, l=20))
    g.annotation_size = 18
    for place in range(4):
        g.fig.add_trace(go.Bar(x=sorted_players, y=data.iloc[place], name=f'{place+1}. mesto',
                               marker_color=colors[place], hoverinfo="y"))

    g.add_annotations(
        [[player, 0, f"{player}<br>({int(games_played[player].iloc[0])} iger)", "black"]
         for player in sorted_players],
        yref="paper",
        yanchor="top",
        xanchor="center"
    )

    g.update_layout(
        barmode='stack'
    )
    g.show_and_save("number_of_wins")


def head_to_head():
    data = pd.read_csv(f'{DIR}/data/head_to_head.csv')
    matrix = data.values
    text = matrix.copy()
    text = text.astype(str)
    text[text == "nan"] = ""
    for i in range(len(matrix)):
        for j in range(len(matrix)):
            if text[i, j] == "":
                continue
            text[i, j] += "%"
    PLAYER_NAMES = list(data.columns)

    g = Graph(annotation_size=18, margins=dict(r=20, t=30, b=10, l=20))
    g.fig.add_trace(go.Heatmap(z=matrix, x=PLAYER_NAMES, y=PLAYER_NAMES[::-1],
                    text=text, texttemplate="%{text}", textfont={"size": 16},
                    colorscale=[(0, "red"), (0.5, "white"), (1, "green")]))

    g.fig.update_yaxes(
        scaleanchor="x",
        scaleratio=1,
    )

    g.add_annotations(
        [[player, 1, player, "#444"] for player in PLAYER_NAMES],
        yref="paper",
        yanchor="bottom",
        xanchor="center"
    )
    g.add_annotations(
        [[-0.6, player, player, "#444"] for player in PLAYER_NAMES[::-1]],
        yanchor="middle",
        xanchor="right"
    )

    g.update_layout()
    g.show_and_save("head_to_head")


def wins_over_time():
    data = json.load(open(f'{DIR}/data/wins_over_time.json'))

    g = Graph()
    for player in PLAYERS:
        y = data[f"{player}_y"]
        x = list(range(len(y)))
        g.fig.add_trace(
            go.Scatter(x=x, y=y, mode='lines', name=player, line=dict(color=COLORS[player])))
        g.fig.add_trace(go.Scatter(x=x, y=y, mode='markers',
                                   name=player, marker=dict(size=6, color=COLORS[player])))

        g.add_annotations(
            [[x[-1], y[-1], player, COLORS[player]]],
            yshift=10,
            xanchor="left",
        )

    g.update_layout()
    g.show_and_save("number_of_wins_over_time")


def points_violin_plot():
    data = pd.read_csv(f'{DIR}/data/games_data_merge_players.csv')
    num_rounds = data.iloc[:, 0]
    data = data.iloc[:, 1:]
    # get the average points per round
    data = data.div(num_rounds, axis=0)

    players = list(data.columns)
    data = data.values
    colors = n_colors('rgb(5, 200, 200)', 'rgb(200, 10, 10)', len(players), colortype='rgb')

    g = Graph(annotation_size=18)
    for i, color in enumerate(colors):
        player_data = data[:, i]
        # remove nan values
        player_data = player_data[~np.isnan(player_data)]
        g.fig.add_trace(go.Violin(x=player_data, line_color=color))
        # annotate the worst, best and mean for each player
        g.add_annotations(
            [[player_data.min(), i, f"{round(player_data.min(), 1)}", color],
             [player_data.max(), i, f"{round(player_data.max(), 1)}", color]],
            xanchor="center",
            yanchor="top"
        )
        # add names
        g.add_annotations(
            [[-30, i + 0.25, players[i], color]],
            xanchor="right",
            yanchor="middle"
        )

    g.fig.update_traces(orientation='h', side='positive', width=3, points='outliers',
                        meanline_visible=True)
    g.update_layout()
    g.show_and_save("points_violin_plot")


def moving_bar_chart_leaderboard():
    data = pd.read_csv(f'{DIR}/data/leaderboard_cumsum.csv')
    # plot the data using plotly
    data = data[PLAYERS]
    data = data.values
    indices = np.argsort(data, axis=1)
    np_players = np.array(PLAYERS)

    print([COLORS[player] for player in np_players])

    g = Graph(margins=dict(r=20, t=20, b=50, l=20), annotation_size=18)
    g.fig = go.Figure(
        data=[go.Bar(
            y=np_players[indices[0]],
            x=[0 for _ in np_players],
            marker_color=[COLORS[player] for player in np_players[indices[0]]],
            orientation='h'
        )],
        layout=go.Layout(
            yaxis=dict(range=[-0.6, len(PLAYERS) - 0.4], autorange=False),
            xaxis=dict(range=[data.min(), data.max() * 1.05], autorange=False),
            updatemenus=[dict(
                type="buttons",
                x=0.5,
                y=1.1,
                direction="left",
                buttons=[
                    dict(
                        label="▶",
                        method="animate",
                        args=[None, {"frame": {"duration": 200, "redraw": True},
                                     "fromcurrent": True, "transition": {"duration": 0, "easing": "linear"}}]
                    ),
                    dict(
                        label="◼",
                        method="animate",
                        args=[[None], {"frame": {"duration": 0, "redraw": False},
                                       "mode": "immediate", "transition": {"duration": 0}}],
                    )
                ]
            )]
        ),
        frames=[go.Frame(data=[go.Bar(
            y=np_players[indices[i]],
            x=data[i][indices[i]],
            marker_color=[COLORS[player] for player in np_players[indices[i]]],
            orientation='h'
        )]) for i in range(len(data))]
    )

    g.update_layout(xaxis={'visible': True}, yaxis={'visible': True})
    g.show_and_save("moving_bar_chart_leaderboard")


def create_leaderboard():
    data = pd.read_csv(f'{DIR}/data/totals.csv', index_col=0)

    min_rounds = 400
    players_with_less_games = data[data["rounds"] < min_rounds]
    # sort by the number of rounds
    players_with_less_games = players_with_less_games.sort_values("rounds")

    link = "window.location.href='https://docs.google.com/spreadsheets/d/1Cv9EgP-gcNYhTOR2O9DxDBdSoSLT0iBg5lDCvBdx51E/edit?usp=sharing'"
    table_string = '<div class="table-container">\n<table>\n<thead><tr><th>' \
                   'Igralec</th><th>Igre</th><th>Runde</th><th>Točke</th><th>na igro</th></tr></thead>\n'
    for player, row in data.iterrows():
        table_string += f'<tr><td>{player}</td><td>{int(row["games"])}</td>' \
                        f'<td>{int(row["rounds"])}</td><td>{int(row["points"])}</td>' \
                        f'<td>{round(row["points_per_round"], 1)}</td></tr>\n'
    table_string += f'</table>\n<br>\n' \
                    f'{generate_html(players_with_less_games, min_rounds)}' \
                    f'<button class ="my-button" onclick="{link}"> VPIŠI TOČKE </button> \n' \
                    f'</div>\n'

    with open(f'{DIR}/texts/leaderboard.txt', "w") as f:
        f.write(table_string)


def generate_html(data, min_rounds=400):
    data = data.sort_values("rounds", ascending=False)
    html = '<div>\n<h4>Napredek do vključitve v grafe</h4>\n'
    for player, row in data.iterrows():
        percentage = round(row["rounds"] / min_rounds * 100)
        if percentage < 20 or player == "Ostali":
            continue
        html += f'{player}\n'
        html += f'<div style="width: 100%; height: 20px; background-color: #FFFFFF;">\n'
        html += f'<div style="width: {percentage}%; height: 20px; background-color: #4CAF50; ' \
                f'text-align: right; padding-right: 10px; font-size: 14px">{percentage}%</div>\n'
        html += '</div><br>\n'
    html += '</div>\n'
    return html


def update_all():
    all_time_leaderboard()
    number_of_places()
    head_to_head()
    wins_over_time()
    last_n_leaderboard()
    create_leaderboard()
    points_violin_plot()
    moving_bar_chart_leaderboard()


if __name__ == '__main__':
    update_all()
