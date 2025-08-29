# Agent Prompts

This file will be the main context and prompts for doing development in this project. We are using Github Copilot in Agent Mode, with Claude Sonnet 4 as our LLM. The instructions in this file are to be interpreted and executed by the AI Agent, one step at a time, based on what our current step is. So to be clear, the AI will be reading this file to decide what to do next at any point during our development of the app we're building.

# Project Plan

We will be building a bare-bones "Task Management" app, in this project. It will be implemented as a VSCode extension. So this project will be a VSCode extension. 

# Development Steps

We're going to let the AI Agent build this app one step at a time, using the following steps:

## Step 1 (complete):

The main thing this extension will do is to create a panel on the left side of the VSCode app which can display a list of files based on certain criteria.We'll need a menu item that can be clicked by the user somewhere in the application and I'll let the AI (you!) decide where to put that menu item. 

So for now let's make things very simple by doing the following: Start by making this folder be a basic VSCode extension called "Task Manager". So the root of this project contains this extension and the extension will be the only thing in this project. so the button we can create to start to have some basic functionality to begin with will be a button called "Show all Tasks". and for now what we'll do is when the user clicks this button we're going to scan the entire folder where the extension is running and find all files containing the hashtag "#task" and simply display all those file names in a list on the left. now we don't want this to be an ordinary search result done by vs code because we're going to have a special way of finding all the files that we want to display in this list that is more advanced than a simple search in the future. so we do need this to be a custom list of file names that the user can click. 

So to clarify all of that, what this vs code extension will do for the users is allow them to click a button and then automatically see all the files that they've got that contain "#task". Obviously we're going to be adding more features later but that's what I would like to accomplish in Step 1 (this step). And in case you're wondering yes it's correct that there are currently no files in this project (except the one you're reading now) so you'll be creating this VSCode extension from scratch, in case that wan't clear.

## Step 2:

Add an actuall menu item or button somewhere that runs our "Show All Tasks"