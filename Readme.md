# 🐧 Linox: The Web-Native Terminal Simulator

> **"Breaking the barriers of Linux. Experience the terminal right in your browser."**

Linox is an **Interactive Shell Simulator** designed to let anyone learn and experience the core philosophy of Linux without the complexity of installation. Built entirely with web technologies, it provides a seamless bridge to the world of open-source operating systems.

---

## 🎯 Our Mission: Lowering the Barrier to Entry
While Linux is powerful, the initial setup (VMs, Dual-booting) can be a daunting wall for beginners. Linox aims to make that **'first step'** as light as possible.

* **Zero Installation**: Experience a Linux-like environment instantly with a single click—no virtual machines required.
* **Safe Playground**: A risk-free environment where you can test commands and scripts without the fear of breaking your system.
* **Educational Bridge**: Serving as a reliable stepping stone for students and hobbyists to get comfortable with the CLI before moving to professional environments.

---

## 🚀 Key Features (Currently Implemented)

### 1. Core Shell Engine
* **Standard Utilities**: `ls`, `cd`, `pwd`, `mkdir`, `touch`, `cp`, `mv`, `rm` for full file system navigation.
* **Advanced Pipelines**: Functional Pipe (`|`) and Redirection (`>`, `>>`) for logical command chaining.
* **Text Processing**: `grep` (with syntax highlighting), `cat`, `head`, `tail`, `wc`, `sort`, and `uniq`.

### 2. Development Simulation
* **Virtual Compiler**: Simulated build process for C++ (`g++`) and Python. Users can compile source code and see the simulated output.
* **Text Editors**: Basic interfaces for `vim` and `nano` to modify virtual files.

### 3. System & Network Monitoring
* **System Status**: `top`, `ps aux`, `free`, `df`, `uptime`, and `uname` for virtual resource monitoring.
* **Networking**: Simulated connectivity tools like `ping`, `curl`, `wget`, `ssh`, and `ifconfig`.

---

## 🛠️ Technical Stack
* **Core**: Pure HTML5, CSS3, and Vanilla JavaScript (No external libraries or frameworks).
* **Architecture**: Designed with a memory-based **Virtual File System (VFS)** and a Regex-based **Command Parser**.

---

## 📅 Roadmap: The Future of Linox
We are constantly evolving to provide a more authentic OS experience.

1.  **Full Interactivity (In Progress)**: Moving beyond output-only models to support `Standard Input (stdin)` for real-time user interaction during execution.
2.  **Logic-based Permissions**: Transitioning `chmod` from a visual-only feature to a functional Access Control logic.
3.  **Persistence Layer**: Implementing `IndexedDB` to ensure your files and configurations remain intact even after closing the browser.
4.  **Learning Modules**: Introducing gamified quests and tutorials to guide users from "Novice" to "Linux Master."

---

## ⚠️ Known Issues & Notes
* As a JavaScript-based emulator, internal logic may differ from an actual Linux kernel.
* **Interactive Input** is currently under development.
* **File Permissions (`chmod`)** are currently for visual demonstration and do not yet restrict actual file access.

---

### 👨‍💻 Developer
* **Lee Han Seong** - *Busan Software Meister High School*
