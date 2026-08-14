# Linux Fundamentals - Permissions, Mounts, and Symlinks

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

---

## Mounts vs. Symbolic Links (Symlinks)

In Linux, managing filesystems and shortcuts involves two key concepts: **Mounts** and **Symbolic Links (Symlinks)**. Here is how they work and differ.

### 1. What is a Mount?
A **Mount** associates a physical storage device or partition (like a hard drive, USB flash drive, or network drive) with a specific directory in the Linux directory tree.
* **Why it exists**: Linux does not use drive letters (like `C:` or `D:`). Everything resides under a single root directory `/`. To read a USB drive, you must "mount" it to a folder directory.
* **Kernel Level**: Mounting is a system-level operation managed by the kernel and requires administrator (`sudo`) privileges.

### 2. What is a Symbolic Link (Symlink)?
A **Symbolic Link** (also called a soft link) is a special shortcut file that points to another file or directory on the system.
* **Why it exists**: Similar to a Windows desktop shortcut. It lets you create a fast path to a file buried deep in the folder hierarchy.
* **User Level**: Any user can create a symlink for files they own; it doesn't require root privileges.
* **Dangling Link**: If the original target file is deleted, the symlink remains but becomes "broken".

---

### Key Differences

| Feature | Mount | Symbolic Link (Symlink) |
| :--- | :--- | :--- |
| **Concept** | Attaching hardware/filesystem to a folder. | Creating a shortcut pointer file. |
| **Target** | Hard drive partition, USB device, ISO, NFS share. | Any existing file or directory path. |
| **Command** | `sudo mount /dev/sdb1 /mnt/usb` | `ln -s /path/to/target /path/to/shortcut` |
| **Privileges** | Requires administrator (`root` / `sudo`). | User level (no `sudo` needed). |
| **Persistence** | Disappears on reboot (unless added to `/etc/fstab`). | Permanent until you delete the shortcut file. |

---

### General Examples

#### A. Mount Example: Accessing a USB Drive
When you plug in a USB drive, Linux represents the hardware as a device file (e.g., `/dev/sdb1`). You cannot read it directly; you must mount it:

```bash
# 1. Create an empty directory to act as the mount point
mkdir -p /mnt/myusb

# 2. Mount the USB partition to that directory
sudo mount /dev/sdb1 /mnt/myusb

# 3. Now you can view the USB files inside the folder
ls -la /mnt/myusb

# 4. Before pulling the USB out, unmount it safely
sudo umount /mnt/myusb
```

#### B. Symbolic Link Example: Config Shortcut
If you frequently edit an Nginx configuration file at `/etc/nginx/nginx.conf`, you can create a symlink in your home folder so you don't have to navigate there every time:

```bash
# Syntax: ln -s <real_target_path> <shortcut_name>
ln -s /etc/nginx/nginx.conf ~/nginx-shortcut.conf

# Now you can view or edit the file directly using the shortcut:
cat ~/nginx-shortcut.conf
```

---

## Directory Level: Folder Mount (Bind Mount) vs. Directory Symlink

If you want to link or mirror one folder (`/source/folder`) into another directory (`/target/folder`), you can do this in two ways.

### 1. The Directory Symlink (Shortcut)
This creates a simple pointer file that redirects requests to the source directory.

* **Command**:
  ```bash
  ln -s /source/folder /target/folder
  ```
* **Pros**: Simple, does not require `sudo` to create, and deleting the link `/target/folder` only deletes the shortcut, not the source files.
* **Cons**: Some applications/services (like Nginx, Apache, FTP servers, or Docker) disable following symlinks by default for security.

### 2. The Folder Bind Mount
This mounts the source directory directly to the target directory. It makes the target folder behave exactly like a real physical directory containing those files.

* **Command**:
  ```bash
  # 1. Create target folder if it doesn't exist
  mkdir -p /target/folder

  # 2. Mount source directory to target directory (requires sudo)
  sudo mount --bind /source/folder /target/folder
  ```
* **Pros**:
  * Invisible to application security policies (behaves exactly like a real directory).
  * Works inside `chroot` jails or container boundaries.
  * You can mount folders across different physical hard drives or network locations.
* **Cons**:
  * Requires `root`/`sudo` privileges.
  * **Danger**: If you run `rm -rf /target/folder/*` while it is mounted, you will delete the files in `/source/folder`!
  * Disappears on reboot unless registered in `/etc/fstab`.

#### Unmounting a Bind Mount
When you are done, unmount the folder:
```bash
sudo umount /target/folder
```

