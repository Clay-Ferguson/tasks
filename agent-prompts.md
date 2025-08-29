# Agent Prompts

This file will be the main context and prompts for doing development in this project. We are using Github Copilot in Agent Mode, with Claude Sonnet 4 as our LLM. The instructions in this file are to be interpreted and executed by the AI Agent, one step at a time, based on what our current step is. So to be clear, the AI will be reading this file to decide what to do next at any point during our development of the app we're building.

# Project Plan

We will be building a bare-bones "Task Management" app, in this project. It will be implemented as a VSCode extension. So this project will be a VSCode extension. 

# Development Steps

We're going to let the AI Agent build this app one step at a time, using the following steps:

## Step 1 (completed):

The main thing this extension will do is to create a panel on the left side of the VSCode app which can display a list of files based on certain criteria.We'll need a menu item that can be clicked by the user somewhere in the application and I'll let the AI (you!) decide where to put that menu item. 

So for now let's make things very simple by doing the following: Start by making this folder be a basic VSCode extension called "Task Manager". So the root of this project contains this extension and the extension will be the only thing in this project. so the button we can create to start to have some basic functionality to begin with will be a button called "Show all Tasks". and for now what we'll do is when the user clicks this button we're going to scan the entire folder where the extension is running and find all files containing the hashtag "#task" and simply display all those file names in a list on the left. now we don't want this to be an ordinary search result done by vs code because we're going to have a special way of finding all the files that we want to display in this list that is more advanced than a simple search in the future. so we do need this to be a custom list of file names that the user can click. 

So to clarify all of that, what this vs code extension will do for the users is allow them to click a button and then automatically see all the files that they've got that contain "#task". Obviously we're going to be adding more features later but that's what I would like to accomplish in Step 1 (this step). And in case you're wondering yes it's correct that there are currently no files in this project (except the one you're reading now) so you'll be creating this VSCode extension from scratch, in case that wan't clear.

### Step 1 Outcome:

✅ **Completed: Basic Task Manager VSCode Extension**

- Created TypeScript VSCode extension with Activity Bar icon (checklist symbol)
- Implemented TreeDataProvider that scans workspace for files containing "#task" 
- Added custom tree view panel "Task Files" with clickable file list
- Commands: `task-manager.showAllTasks` and `task-manager.refreshTasks`
- Recursive file scanning with duplicate prevention and smart directory skipping
- Files open directly when clicked in the tree view
- Git repository initialized with initial commit
- Extension compiles successfully, ready for testing with F5

## Step 2 (completed):

Next add a further condition to the existing search for "#task" keyword, and require the files to also (in addition to containing "#task") contain a timestamp formatted like this example: "[2025/06/15 04:25:50 PM]". You can use this REGEX which I already know works: `\\[20[0-9][0-9]/[0-9][0-9]/[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9] (AM|PM)\\]`. We do this because for a file to represent a Task one of the things is must contain is a due date, and whatever timestamp we see in the file is automatically the due date.

## Step 3 (completed):

Next let's order the files by the timestamp in the file (the same timestamp I mentioned in Step 2 above), in order to display the files in chronological order in our Task Manager panel. You'll probably want to create a container object to hold each file so you can have your object have the filename, and the timestamp kept together in that object. In other words, please don't put all the timestamps in an array by themselves, ...but you probably already knew better than to make that mistake.

## Step 4 (completed):

At the top of our Task Manager panel next to the "Show All Tasks" icon, create another icon named "Tasks Due Soon", and make it find all task files, but with the additional criteria that the timestamp is no more than 3 days into the future. So by "soon" we mean 3 days.

## Step 5 (completed):

Next to the "Tasks Due Soon" icon please create another icon named "Tasks Overdue". This will of course show the task files that have a timestamp at some point in the past.