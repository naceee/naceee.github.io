import requests
import pandas as pd


def download_as_csv():
    response = requests.get("https://docs.google.com/spreadsheets/d/"
                            "1Cv9EgP-gcNYhTOR2O9DxDBdSoSLT0iBg5lDCvBdx51E/export?format=csv")
    assert response.status_code == 200, 'Wrong status code'
    # write to file
    with open('raw_data.csv', 'wb') as f:
        f.write(response.content)


def create_df_from_csv():
    # read the csv file line by line
    with open('raw_data.csv', 'r') as f:
        lines = f.readlines()
    # remove the first line
    lines = lines[2:]
    lines = [l.split(",")[2:9] for l in lines if l[1] != ","]

    lines_df = pd.DataFrame(lines[1:], columns=lines[0])
    lines_df = lines_df.apply(pd.to_numeric, errors='ignore')
    # save the dataframe
    lines_df.to_csv('data.csv', index=False)


if __name__ == '__main__':
    # download_as_csv()
    create_df_from_csv()
