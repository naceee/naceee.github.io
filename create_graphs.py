import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import numpy as np

PLAYERS = ["Peter", "Jernej", "Gašper", "Blaž", "Nace", "Martin Mica Kristina"]


def all_time_leaderboard():
    data = pd.read_csv('data.csv')
    # for each player, compute the cumulative sum of their scores over time
    # change Nan to 0
    data = data.fillna(0)
    for player in PLAYERS:
        data[player] = data[player].cumsum()

    # plot the data using plotly
    fig = go.Figure()
    for player in PLAYERS:
        x = data.index
        y = data[player]
        fig.add_trace(go.Scatter(x=x, y=y, mode='lines', name=player))

    fig.update_layout(
        title='All time leaderboard',
        xaxis_title='Game number',
        yaxis_title='Score')
    fig.show()
    fig.write_html("all_time_leaderboard.html")


if __name__ == '__main__':
    all_time_leaderboard()
