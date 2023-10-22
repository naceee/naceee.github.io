import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import numpy as np
import matplotlib
from heapq import nlargest

PLAYERS = ["Peter", "Jernej", "Gašper", "Blaž", "Nace", "Ostali"]
cmap = matplotlib.colormaps['Set2']
COLORS = [f"rgb{(cmap(i)[0], cmap(i)[1], cmap(i)[2])}" for i in range(6)]
print(COLORS)

def all_time_leaderboard():
    data = pd.read_csv('data.csv')
    # for each player, compute the cumulative sum of their played games as the cumsum of the column
    # "st. iger" for all the rows where the player is not NaN
    for player in PLAYERS:
        f = lambda igra, pl: igra if not np.isnan(pl) else 0
        data[f"{player}_games"] = data.apply(lambda x: f(x.st_iger, x[f"{player}"]), axis=1)
        data[f"{player}_games"] = data[f"{player}_games"].cumsum()

    # change Nan to 0
    data = data.fillna(0)
    for player in PLAYERS:
        data[player] = data[player].cumsum()

    # plot the data using plotly
    fig = go.Figure()
    for player in PLAYERS:
        x = data[f"{player}_games"]
        y = data[player]
        fig.add_trace(go.Scatter(x=x, y=y, mode='lines', name=player,
                                 line=dict(color=COLORS[PLAYERS.index(player)])))

    # put the yaxis title on the right side
    fig.update_layout(
        title='Večna lestvica',
        xaxis_title='Število iger',
        yaxis_title='Število točk',
        plot_bgcolor="white",
        showlegend=False,
        margin=dict(r=100, t=50, b=50, l=50),
        yaxis={'side': 'right'}
    )

    # compute the end score for each player
    end_scores = data.iloc[-1]
    # sort the players by their end score
    end_scores = end_scores.sort_values(ascending=False)
    print(end_scores)
    y_positions = arrange_positions(end_scores)

    # add the end score to the plot
    for player in PLAYERS:
        fig.add_annotation(
            x=data[f"{player}_games"].iloc[-1],
            y=y_positions[player],
            text=player,
            showarrow=False,
            yshift=10,
            xanchor="left",
            font=dict(
                size=12,
                color=COLORS[PLAYERS.index(player)]
            )
        )

        ranking = end_scores.index.get_loc(player) + 1
        print(player, ranking, 1 - (ranking - 1) / 10)
        fig.add_annotation(
            x=0,
            y=1 - (ranking - 1) / 15,
            text=f"{ranking}. {player}: {int(data[player].iloc[-1])} "
                 f"({int(data[f'{player}_games'].iloc[-1])} iger)",
            showarrow=False,
            xref="paper",
            yref="paper",
            xanchor="left",
            yanchor="top",
            font=dict(
                size=18,
                color=COLORS[PLAYERS.index(player)]
            )
        )

    fig.show()
    fig.write_html("all_time_leaderboard.html")


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
    data = pd.read_csv('data.csv')
    data = data[PLAYERS]
    data = data.iloc[1:]
    data = data.fillna(-np.inf)

    def f(row):
        x = nlargest(4, enumerate(row.to_list()), key=lambda x: x[1])
        for i in range(4):
            row[x[i][0]] = i + 1

    data.apply(f, axis=1)
    data = data.replace(-np.inf, np.nan)
    # count the number of places for each player
    data = data.apply(pd.value_counts)
    # divide each column by its sum:
    for player in PLAYERS:
        data[player] = data[player] / data[player].sum()

    players_with_wins = list(zip(list(data.iloc[0]), list(data.columns)))
    players_with_wins.sort(reverse=True)
    sorted_players = [p[1] for p in players_with_wins]
    data = data[sorted_players]

    colors = ["gold", "silver", "peru", "#edebe1"]

    fig = go.Figure(go.Bar(x=sorted_players, y=data.iloc[0],
                           name=f'1. mesto', marker_color=colors[0]))
    for place in range(1, 4):
        fig.add_trace(go.Bar(x=sorted_players, y=data.iloc[place], name=f'{place+1}. mesto',
                             marker_color=colors[place]))

    fig.update_layout(
        barmode='stack',
        plot_bgcolor="white",
        yaxis={'visible': False},
        title='Delež uvrstitev posameznika',
    )
    fig.show()
    fig.write_html("number_of_wins.html")


if __name__ == '__main__':
    all_time_leaderboard()
    number_of_places()
