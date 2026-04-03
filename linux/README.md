# Linux Fundamentals - Permissions (chmod, chown)

This README explains file permissions and ownership in plain language.

## File Permissions Basics

Example (`ls -l` output):
```
-rw-r--r--  1 user group  1234 Apr 3  file.txt
```

Meaning:
- `-` = file type (`d` would be a directory)
- `rw-` = owner permissions (read, write)
- `r--` = group permissions (read)
- `r--` = others permissions (read)
- `user` = owner name
- `group` = group name

## chmod (change permissions)

### Symbolic mode (read it like a sentence)

- `u` = user (owner), `g` = group, `o` = others, `a` = all
- `+` add, `-` remove, `=` set exactly

```bash
chmod u+x script.sh       # add execute for owner
chmod g-w file.txt        # remove write for group
chmod o+r file.txt        # add read for others
chmod a+r file.txt        # add read for everyone
chmod u=rw,g=r,o= file.txt  # set exact permissions
```

### Numeric mode (quick math)

- `r=4, w=2, x=1`
- Examples:

```bash
chmod 644 file.txt   # rw-r--r--
chmod 755 app.sh     # rwxr-xr-x
chmod 600 secret.txt # rw-------
```

How to read `755`:
- Owner: `7` = 4+2+1 = rwx
- Group: `5` = 4+0+1 = r-x
- Others: `5` = 4+0+1 = r-x

## chown (change owner and group)

Ownership controls who the **owner** and **group** are. Permissions decide what each can do.

```bash
chown user file.txt              # change owner
chown user:group file.txt        # change owner and group
chown -R user:group folder/      # recursive
```

## Real‑World Examples

- Make a script executable:
  ```bash
  chmod +x deploy.sh
  ```

- Protect a secret file:
  ```bash
  chmod 600 .env
  ```

- Fix ownership after copying files with sudo:
  ```bash
  chown -R ubuntu:ubuntu app/
  ```

## Quick Rules (Remember This)

- Files need **read** to view, **write** to edit, **execute** to run.
- Directories need **read** to list, **write** to create/delete, **execute** to enter.

## Common Commands (tail, top, vim, watch, wc)

### `tail`

Show the last lines of a file (useful for logs).

```bash
tail -n 20 app.log      # last 20 lines
tail -f app.log         # follow log updates
```

Real life example: watch a server log while deploying to confirm the app started.

### `top`

Live view of CPU, memory, and running processes.

```bash
top
```

Press `q` to quit.

Real life example: check which process is eating CPU when the server feels slow.

### `vim`

Terminal text editor.

Basic flow:
- `vim file.txt` open
- `i` insert mode
- `Esc` exit insert mode
- `:wq` save and quit
- `:q!` quit without saving

Real life example: quickly edit an Nginx config file on a remote server.

### `watch`

Run a command repeatedly to see changes.

```bash
watch -n 2 "df -h"     # refresh every 2 seconds
watch -n 1 "ls -l"     # live directory view
```

Real life example: monitor disk space during a large file upload.

### `wc`

Count lines, words, bytes.

```bash
wc file.txt       # lines, words, bytes
wc -l file.txt    # just lines
wc -w file.txt    # just words
```

Real life example: count lines in a log to estimate request volume.
