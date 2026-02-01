import json
import os

import numpy as np
import pandas as pd
from matplotlib import pyplot as plt

DIR = os.path.dirname(os.path.abspath(__file__))

game_data = pd.read_csv(f"{DIR}/data/games_data_merge_players.csv")

COLORMAP = [
    "#66c2a5",
    "#fc8d62",
    "#8da0cb",
    "#e78ac3",
    "#a6d854",
    "#ffd92f",
    "#e5c494",
    "#b3b3b3",
]
PLAYERS = list(game_data.columns[1:])
COLORS = {player: color for (player, color) in zip(PLAYERS, COLORMAP)}
MARKERS = {
    player: dash
    for (player, dash) in zip(PLAYERS, ["o", "v", "s", "*", "D", "X", "P", "^"])
}


POINTS = pd.read_csv(f"{DIR}/data/totals.csv", index_col=0)["points"]
POINTS = [POINTS[p] for p in PLAYERS]
PLAYERS = np.array(PLAYERS)[np.argsort(POINTS)][::-1]
print([(pl, po) for (pl, po) in zip(PLAYERS, POINTS)])

plt.rcParams["axes.facecolor"] = "#f9fafb"
plt.rcParams["savefig.facecolor"] = "#f9fafb"


def graph_style_and_save(
    ax, save_name, title=None, y_label=None, x_label=None, grid_axis="both"
):
    # Title & Labels
    if title is not None:
        plt.title(title, fontsize=14, fontweight="bold")
    if y_label is not None:
        plt.ylabel(y_label, fontsize=12)
    if x_label is not None:
        plt.xlabel(x_label, fontsize=12)

    plt.xticks(fontsize=12)
    plt.yticks(fontsize=12)

    if grid_axis is not None:
        plt.grid(axis=grid_axis, linestyle="--", alpha=0.6)
    # plt.legend(loc="upper right", fontsize=12, title="Placement")
    plt.legend(fontsize=12, frameon=True, loc="upper left", bbox_to_anchor=(1, 1))

    plt.tight_layout()
    plt.savefig(f"{DIR}/graphs/{save_name}.png")
    plt.show()


def all_time_leaderboard():
    data = pd.read_csv(f"{DIR}/data/leaderboard_cumsum.csv")
    # plot the data using plotly
    fig, ax = plt.subplots(figsize=(10, 6))
    for player in PLAYERS:
        x = [0] + list(data[f"{player}_games"])
        y = [0] + list(data[player])
        x, y, markers = get_markers(x, y)
        plt.plot(
            x,
            y,
            color=COLORS[player],
            label=player,
            linewidth=2,
            marker=MARKERS[player],
            markevery=markers,
            zorder=1 / y[-1],
        )

    graph_style_and_save(
        ax,
        "vecna_lestvica",
        title="Večna lestvica",
        y_label="Skupno število točk",
        x_label="Odigrane runde",
    )


def moving_average(data: list[float], window_size=7):
    """Compute the moving average of a 1D list that is the same length as the input -
    buffer with 1500 at the start."""
    padded_data = [1500] * (window_size) + data
    cumsum = np.cumsum(padded_data)
    moving_averages = (cumsum[window_size:] - cumsum[:-window_size]) / window_size
    return moving_averages.tolist()


def elo_ratings():
    data = pd.read_csv(f"{DIR}/data/elo_ratings.csv")
    # plot the data using plotly
    fig, ax = plt.subplots(figsize=(10, 6))
    for player in PLAYERS:
        y = [1500] + list(data[player])
        y = moving_average(y, window_size=7)

        x = list(range(len(y)))
        x, y, markers = get_markers(x, y)
        plt.plot(
            x,
            y,
            color=COLORS[player],
            label=player,
            linewidth=2,
            marker=MARKERS[player],
            markevery=markers,
            zorder=1 / y[-1],
        )

    graph_style_and_save(
        ax,
        "elo_ratings",
        title="Elo ocena igralcev skozi čas",
        y_label="Elo",
        x_label="Odigrane igre",
    )


def get_markers(x, y):
    dx = np.diff(x)
    y = np.array(y[1:])[dx > 0]
    x = np.array(x[1:])[dx > 0]
    dx = np.diff(x)
    dy = np.diff(y)
    ppg = dy / dx
    ddy = np.abs(np.diff(ppg))
    markers = np.where(ddy > 75)[0] + 1
    return x, y, list(markers) + [-1]


def number_of_places():
    data = pd.read_csv(f"{DIR}/data/number_of_places.csv")
    sorted_players = list(data.columns)

    first = data.iloc[0].values
    second = data.iloc[1].values
    third = data.iloc[2].values
    fourth = 100 - (first + second + third)

    colors = ["#1f77b4", "#6baed6", "#9ecae1", "#c6dbef"]

    # Plot the data
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.bar(sorted_players, first, color=colors[0], label="1. mesto")
    ax.bar(sorted_players, second, bottom=first, color=colors[1], label="2. mesto")
    ax.bar(
        sorted_players, third, bottom=first + second, color=colors[2], label="3. mesto"
    )
    ax.bar(
        sorted_players,
        fourth,
        bottom=first + second + third,
        color=colors[3],
        label="4. mesto",
    )

    # Add Data Labels Inside Bars
    for i, (p1, p2, p3, p4) in enumerate(zip(first, second, third, fourth)):
        plt.text(
            i,
            p1 / 2,
            f"{round(p1, 1)}%",
            ha="center",
            va="center",
            fontsize=12,
            color="black",
        )
        plt.text(
            i,
            p1 + p2 / 2,
            f"{round(p2, 1)}%",
            ha="center",
            va="center",
            fontsize=12,
            color="black",
        )
        plt.text(
            i,
            p1 + p2 + p3 / 2,
            f"{round(p3, 1)}%",
            ha="center",
            va="center",
            fontsize=12,
            color="black",
        )
        plt.text(
            i,
            p1 + p2 + p3 + p4 / 2,
            f"{round(p4, 1)}%",
            ha="center",
            va="center",
            fontsize=12,
            color="black",
        )

    graph_style_and_save(
        ax,
        "delez_uvrstitev",
        title="Delež uvrstitev",
        y_label="Delež iger",
        grid_axis="y",
    )


def wins_over_time():
    data = json.load(open(f"{DIR}/data/wins_over_time.json"))

    fig, ax = plt.subplots(figsize=(10, 6))
    for player in PLAYERS:
        y = data[f"{player}_y"]
        x = list(range(len(y)))
        plt.plot(
            x, y, color=COLORS[player], label=player, linewidth=2, zorder=1 / y[-1]
        )

    graph_style_and_save(
        ax,
        "zmage_skozi_cas",
        title="Večna lestvica zmag",
        y_label="Število zmag",
        x_label="Število iger",
    )


def create_leaderboard():
    data = pd.read_csv(f"{DIR}/data/totals.csv", index_col=0)
    table_string = '<tr class="border-bottom-thick"><th>Igralec</th><th>Igre</th><th>Runde</th><th>Točke</th><th>Zmage</th></tr>\n'
    for player, row in data.iterrows():
        table_string += (
            f"<tr><td>{player}</td><td>{int(row['games'])}</td>"
            f"<td>{int(row['rounds'])}</td><td>{int(row['points'])}</td>"
            f"<td>{round(row['wins'], 1)}</td></tr>\n"
        )

    with open(f"{DIR}/texts/leaderboard.txt", "w", encoding="utf-8") as f:
        f.write(table_string)


def update_all():
    all_time_leaderboard()
    number_of_places()
    wins_over_time()
    create_leaderboard()
    elo_ratings()


if __name__ == "__main__":
    update_all()
