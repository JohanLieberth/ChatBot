import os

with open('Index.html', 'r') as f:
    index = f.read()

with open('CSS.html', 'r') as f:
    css = f.read()

with open('JS.html', 'r') as f:
    js = f.read()

combined = index.replace("<?!= include('CSS'); ?>", css).replace("<?!= include('JS'); ?>", js)

with open('verification/combined_index.html', 'w') as f:
    f.write(combined)
