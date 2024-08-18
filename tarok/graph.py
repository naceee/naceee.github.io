import plotly.graph_objects as go
import os

DIR = os.path.dirname(os.path.abspath(__file__))


class Graph:
    def __init__(self, **kwargs):
        self.fig = go.Figure()
        self.annotation_size = 14
        self.margins = dict(r=20, t=20, b=20, l=20)

        # loop over kwargs and set self.key = value
        for key, value in kwargs.items():
            setattr(self, key, value)

    def update_layout(self, **kwargs):
        default_values = dict(
            plot_bgcolor="white",
            xaxis={'visible': False},
            yaxis={'visible': False},
            showlegend=False,
            margin=dict(self.margins)
        )
        default_values.update(kwargs)
        self.fig.update_layout(**default_values)

    def show_and_save(self, filename):
        self.fig.show()
        self.fig.write_html(f'{DIR}/graphs/{filename}.html')

    def add_annotations(self, x_y_text_color, **kwargs):
        for x, y, text, color in x_y_text_color:
            self.fig.add_annotation(
                x=x,
                y=y,
                text=text,
                showarrow=False,
                font=dict(
                    size=self.annotation_size,
                    color=color,
                    family="arial"
                ),
                **kwargs
            )
