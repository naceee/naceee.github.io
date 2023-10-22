import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import numpy as np

PLAYERS = ["Peter", "Jernej", "Gašper", "Blaž", "Nace", "Martin Mica Kristina"]
COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"]

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
        margin=dict(r=100, t=50, b=50, l=50)
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
            text=f"{int(data[player].iloc[-1])}: {player}",
            showarrow=False,
            yshift=10,
            xanchor="left",
            font=dict(
                size=12,
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


if __name__ == '__main__':
    all_time_leaderboard()
