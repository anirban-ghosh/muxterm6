This branch is a feature branch for an SFTP browser for MuxTerm.

User Journey:
    SFTP browser shows up only in the App Menu. It is not generally part of the terminal.
    When the user selects SFTP Browser from the App Menu, a new window opens. This window is always a 2-pane window with the left pane acting as the local file browser and the right pane acting as the remote file browser.
    The local file browser always starts at $HOME
    The remote file browser starts at $HOME by default unless specified by the user.
    There should be a drop down menu showing all available SSH servers (list read from ~/.ssh/config), and an option to connect to a custom hostname.
        If user selects a custom server, Collect username, hostname, port, ssh key (optional), path (optional) from the user.
        If the user needs to auth RSA signature of the server, ask that feedback from the user.
        If a password is needed, take that input
    There should be an address bar on top of both panes showing the current path and allowing the user to enter / change the path.
    Always show hidden files on both sides.

Intra Node File actions:
    Dragging and dropping files/folders within a pane to a different directory triggers a move. copy/paste and cut/paste within a pane work the same way as a normal file browser.

Inter Node File actions:
    Dragging and dropping files/folders across panes copies the files/folders from the source to destination server

Double clicking a directory on either pane opens that directory in that pane and updates the address bar.
Double clicking a file on the local pane opens the file locally
Double clicking a file on the remote pane downloads the file (copies from remote->local)
    This avoids confusing opens of remote files where the user might think they've changed the file on the remote server but the file they change is actually a tmp file locally that didn't sync.

Copy conflicts: always prompt the user on copy conflicts when the files exists in the destination. Options to cancel, overwrite or rename. If rename is picked, auto rename by pre-pending "copy_XXX_of_{FILENAME}".
Use rsync for copies - preserve permissions, archive, and show the progress and transfer speed at the bottom of window.
