import requests
import pandas as pd
import numpy as np
from heapq import nlargest


def download_as_csv():
    response = requests.get("https://docs.google.com/spreadsheets/d/"
                            "1Cv9EgP-gcNYhTOR2O9DxDBdSoSLT0iBg5lDCvBdx51E/export?format=csv")
    assert response.status_code == 200, 'Wrong status code'
    # write to file
    with open('data/raw_data.csv', 'wb') as f:
        f.write(response.content)


def create_df_from_csv():
    # read the csv file line by line
    with open('data/raw_data.csv', 'r') as f:
        lines = f.readlines()
    # remove the first line
    lines = lines[2:]
    lines = [l.split(",")[2:9] for l in lines if l[1] != ","]
    lines[1] = ["", "0", "0", "0", "0", "0", "0"]

    lines_df = pd.DataFrame(lines[1:], columns=lines[0])
    lines_df = lines_df.apply(pd.to_numeric, errors='ignore')
    # save the dataframe
    lines_df.to_csv('data/game_by_game_data.csv', index=False)


def create_df_with_wins_by_game():
    data = pd.read_csv('data/game_by_game_data.csv')
    games = data["st_iger"]
    data = data.drop(columns=["st_iger"])
    data = data.iloc[1:]
    data = data.fillna(-np.inf)

    def f(row):
        x = nlargest(4, enumerate(row.to_list()), key=lambda x: x[1])
        for i in range(4):
            row[x[i][0]] = i + 1

    data.apply(f, axis=1)
    data = data.replace(-np.inf, np.nan)
    data["st_iger"] = games

    # save the dataframe
    data.to_csv('data/wins_by_game.csv', index=False)


if __name__ == '__main__':
    download_as_csv()
    create_df_from_csv()
    create_df_with_wins_by_game()
