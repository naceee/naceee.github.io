#!/bin/bash

# Run the Python script
C:\\Users\\Nace\\AppData\\Local\\Programs\\Python\\Python38\\python.exe C:\\Users\\Nace\\Desktop\\naceee.github.io\\tarok\\update_points.py

# Check if the Python script ran successfully
if [ $? -eq 0 ]; then
    echo "Python script ran successfully, proceeding with git operations."

    # Change to the directory of your repository
    cd  C:\\Users\\Nace\\Desktop\\naceee.github.io

    # Add all changes to the staging area
    git add .
    
    # If no argument is provided, use "points update" as the commit message
    COMMIT_MESSAGE=${1:-"points update"}

    # Commit the changes
    git commit -m "$COMMIT_MESSAGE"

    # Push the changes to GitHub
    git push

else
    echo "Python script did not run successfully. Aborting git operations."
fi
