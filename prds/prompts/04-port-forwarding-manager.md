Plan and implement a port forwarding manager.

The port forwarding manager will be a menu option, independent of the terminal and sftp browser functions.
Opening the port forwarding manager should open a table view of all currently active port forwards.


Add support for all types of SSH port forwarding - local, remote and dynamic tunnels.

User journey:
    User opens the Port Forwarding Manager which opens a window displaying a list of active tunnels in table format - one row for each tunnel and columns to display the connection parameters (local/remote, host name, ssh port, forwarded ports, etc. ).  There should be a column with a button to pause or terminate the tunnel.  Pausing temporarily disconnects, and gives the option to reusme.  Terminating disconnects and deletes the tunnel.
    Clicking the button to add a new tunnel opens an overlay.
    Overlay should provide a visual representation/diagram of the port forwarding (similar to MobaXterm) to make it easier for inexperienced users. User provides ssh connection details (custom or from ~/.ssh/config) and port forwarding details and starts the tunnel.
Closing the Port Forwarding Manager keeps the tunnels alive.
Quitting the app entirely (Cmd+Q) gracefully closes all existing tunnels.
