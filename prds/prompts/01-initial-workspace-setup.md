Initialize this workspace for Claude code.
We're starting with a blank directory.

The goal of this project is to build a fully functional, full featured, aesthetically pleasing terminal app that works on MacOS and Linux (Ubuntu).

Here is a feature list required for the terminal app:

Terminal look and feel:
- Full terminal emulation with automatic resize, full color, full support for visual apps like ncurses, vim, htop, tqdm.
- Modern look and feel aesthetically
- Tabs: Should have tab management - open, close, rearrange tabs. Exiting the shell on a tab must close the tab
- Windows: Should support creating new windows. Each Window can then have its own set of tabs. Exiting the last tab on a window must close the window

Panes:
- Split panes: Support full featured split panes: vertical and horizontal split panes.
- Panes should be resizable with the mouse
- Vertically splitting a pane should split the current pane, keeping the current pane on the left and the new pane on the right.
- Horizontally splitting a pane should split the current pane, keeping the current pane on the top and the new pane on the bottom.

Development:
- End to end development: plan, implementation, testing, debugging, maintenance should be done exclusively by AI agents
- Full test suite should be developed by the agent. Tests should enable the agent to launch the app, read and analyze logs, view the app's screen, and feed keyboard and mouse inputs to test functionality by observing screen recording in an automated way.
- The project should be developed as a full software development team of agents. An appropriate project structure, framework or scaffolding needs to be generated as necessary by the orchestrating agent.
- Feel free to research and use any tools or mcp servers as necessary. If the right tools/mcps are not installed, guide me to install them.
