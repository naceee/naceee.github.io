from template2html import template_to_html
from create_graphs import update_all
from get_data import save_all
import time


def main():
    save_all()
    time.sleep(1)
    update_all()
    time.sleep(1)
    template_to_html()


if __name__ == '__main__':
    main()

