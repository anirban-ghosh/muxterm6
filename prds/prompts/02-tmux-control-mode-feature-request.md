Phase 2 is to make a full featured tmux control mode integration without breaking the core terminal emulator functionality.

Control mode is a special mode that allows a tmux client to be used to talk to tmux using a simple text-only protocol. It was designed and written by George Nachman and allows his iTerm2 terminal to interface with tmux and show tmux panes using the iTerm2 UI.

A control mode client is just like a normal tmux client except that instead of drawing the terminal, tmux communicates using text. Because control mode is text only, it can easily be parsed and used over ssh(1).

Control mode clients accept standard tmux commands and return their output, and additionally sends control mode only information (mostly asynchronous notifications) prefixed by %. The idea is that users of control mode use tmux commands (new-window, list-sessions, show-options, and so on) to control tmux rather than duplicating a separate command set just for control mode.

Some documentation can be found here: [tmux_cc](https://github.com/tmux/tmux/wiki/Control-Mode)
This is a link to the tmux repository: [tmux](https://github.com/tmux/tmux)

You need to study tmux control mode thoroughly to implement the functionality of iTerm2 in our terminal emulator.

iTerm2 behavior:
- tmux control mode is triggered whenever the user invokes any 'tmux' command with the -CC command line option.
- when triggered the app opens a new window and attaches to the tmux session. The new window behaves like a client to the tmux server.
- if the control mode was triggered on the local host, the app attaches to tmux sessions on the local host.
- if control mode was triggered on a remote host (say over ssh), the app attaches to the tmux sessions on the remote host.
- Once attached, the existing (triggering) terminal stops taking inputs, and instead displays a command menu (esc to Detach, X to Force-quit, L to Toggle logging, C to Run tmux command)

Below is the mapping between tmux primitives and our app's primitives:
tmux session -> app window
tmux window -> app tab
tmux panes -> app panes

Therefore, upon attach:
- A new window is opened mapping to the tmux session
- One app tab is opened for each tmux window in the session
- Each app tab loads the panes of the tmux window it is attached to. The relative positions and sizes of the panes must be maintained.
- The full tmux scrollback history of each tmux pane should be pre-loaded into the scrollback buffer of the app-pane it is displayed on. This enables native scrolling immediately on attach.
- tmux panes should not lose any of the full featured characteristics of the normal terminal like full color, full xterm support, display visually complex apps like vim and htop correctly, auto-resize.
