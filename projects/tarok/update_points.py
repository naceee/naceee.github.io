import time

from create_graphs import update_all
from data_preprocessing import save_all
from template2html import template_to_html


def main():
    save_all()
    time.sleep(1)
    update_all()
    time.sleep(1)
    template_to_html()


if __name__ == "__main__":
    main()
