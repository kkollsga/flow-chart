// --- Project Management ---
class ProjectManager {
    constructor(diagramManager) {
        this.diagramManager = diagramManager;
        this.projects = [];
        this.currentProjectId = null;
        this.storageKey = 'markdownDiagramProjects';
        this.projectListEl = document.getElementById('project-list');
        this.noProjectsMessage = document.getElementById('no-projects-message');
        this.projectNameInput = document.getElementById('project-name');
        this.settingsMenu = document.getElementById('settings-menu');
        this.textScaleValue = document.getElementById('text-scale-value');
        this.newProjectForm = document.getElementById('new-project-form');
        this.addProjectToggle = document.getElementById('add-project-toggle');
        
        // Store which project is currently being edited/confirmed for deletion
        this.editingProjectId = null;
        this.confirmingDeleteId = null;
        this.showingNewProjectForm = false;
        
        // Initialize import and export managers
        this.importManager = new ImportManager(this);
        this.exportManager = new ExportManager(this);
        this.svgExportManager = new SVGExportManager(diagramManager);
        
        this.loadProjects();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Settings button opens the menu
        document.getElementById('settings-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSettingsMenu();
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.settingsMenu.contains(e.target) && 
                e.target.id !== 'settings-button' && 
                !e.target.closest('#settings-button')) {
                this.hideSettingsMenu();
            }
        });
        
        // Add project toggle
        this.addProjectToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleNewProjectForm();
        });
        
        // Commit new project
        document.getElementById('commit-new-project').addEventListener('click', (e) => {
            e.stopPropagation();
            this.createNewProject();
        });
        
        // Cancel new project
        document.getElementById('cancel-new-project').addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideNewProjectForm();
        });
        
        // Create project on Enter
        this.projectNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createNewProject();
            }
        });
        
        // Cancel on Escape key
        this.projectNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideNewProjectForm();
            }
        });
        
        // Text size decrease button
        document.getElementById('text-scale-decrease').addEventListener('click', (e) => {
            e.stopPropagation();
            this.changeTextScale(-0.05);
        });
        
        // Text size increase button
        document.getElementById('text-scale-increase').addEventListener('click', (e) => {
            e.stopPropagation();
            this.changeTextScale(0.05);
        });
        
        // Import button
        document.getElementById('import-projects-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.importManager.openModal();
        });
        
        // Export button
        document.getElementById('export-projects-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.exportManager.openModal();
        });
        
        // Export to SVG button
        document.getElementById('export-svg-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.svgExportManager.exportSVGFile();
        });

        document.getElementById('copy-svg-button').addEventListener('click', async (e) => {
            e.stopPropagation();
            const btn = document.getElementById('copy-svg-button');
            const icon = btn.querySelector('i');
            const ok = await this.svgExportManager.copySVGToClipboard();
            // Brief feedback: swap to a check (or a cross on failure), then back.
            icon.className = ok ? 'fas fa-check' : 'fas fa-times';
            setTimeout(() => { icon.className = 'fas fa-copy'; }, 1200);
        });
    }
    
    // Change text scale by the specified delta
    changeTextScale(delta) {
        const settings = JSON.parse(localStorage.getItem('markdownDiagramSettings') || '{"textScale":1.0}');
        let newScale = Math.round((settings.textScale + delta) * 100) / 100; // Round to 2 decimal places
        
        // Constrain to reasonable range (0.5 to 2.0)
        newScale = Math.max(0.5, Math.min(2.0, newScale));
        
        // Update settings
        settings.textScale = newScale;
        localStorage.setItem('markdownDiagramSettings', JSON.stringify(settings));
        
        // Update display
        this.textScaleValue.textContent = `${newScale.toFixed(2)}x`;
        
        // Apply the setting
        document.documentElement.style.setProperty('--font-scale', newScale);
        
        // Update box sizes
        clearTimeout(this._resizeTimeout);
        this._resizeTimeout = setTimeout(() => {
            this.diagramManager.updateAllBoxSizes();
        }, 50);
    }
    
    toggleNewProjectForm() {
        if (this.showingNewProjectForm) {
            this.hideNewProjectForm();
        } else {
            this.showNewProjectForm();
        }
    }
    
    showNewProjectForm() {
        this.showingNewProjectForm = true;
        this.newProjectForm.classList.remove('hidden');
        
        // Use setTimeout to ensure transition works
        setTimeout(() => {
            this.newProjectForm.style.maxHeight = '100px';
            // Focus the input field
            this.projectNameInput.focus();
        }, 10);
    }
    
    hideNewProjectForm() {
        this.showingNewProjectForm = false;
        this.newProjectForm.style.maxHeight = '0';
        this.projectNameInput.value = '';
        
        // Hide after transition
        setTimeout(() => {
            this.newProjectForm.classList.add('hidden');
        }, 200);
    }
    
    toggleSettingsMenu() {
        if (this.settingsMenu.classList.contains('hidden')) {
            this.showSettingsMenu();
        } else {
            this.hideSettingsMenu();
        }
    }
    
    showSettingsMenu() {
        this.settingsMenu.classList.remove('hidden');
        
        // Animate in
        setTimeout(() => {
            this.settingsMenu.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
            this.settingsMenu.classList.add('opacity-100', 'translate-y-0');
        }, 10);
        
        // Update project list when showing menu
        this.renderProjectList();
    }
    
    hideSettingsMenu() {
        // Reset all sub-states
        this.hideNewProjectForm();
        this.editingProjectId = null;
        this.confirmingDeleteId = null;
        
        // Animate out
        this.settingsMenu.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
        this.settingsMenu.classList.remove('opacity-100', 'translate-y-0');
        
        // Hide after animation
        setTimeout(() => {
            this.settingsMenu.classList.add('hidden');
        }, 200);
    }
    
    loadProjects() {
        try {
            const storedProjects = localStorage.getItem(this.storageKey);
            if (storedProjects) {
                this.projects = JSON.parse(storedProjects);
                this.renderProjectList();
                
                // Load last active project if exists
                const lastActiveId = localStorage.getItem('lastActiveProject');
                if (lastActiveId && this.projects.find(p => p.id === lastActiveId)) {
                    this.loadProject(lastActiveId);
                } else if (this.projects.length > 0) {
                    // Load first project if no last active
                    this.loadProject(this.projects[0].id);
                }
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            this.projects = [];
        }
        
        this.updateProjectsVisibility();
        this.updateProjectTitle();
    }
    
    saveProjects() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.projects));
            if (this.currentProjectId) {
                localStorage.setItem('lastActiveProject', this.currentProjectId);
            }
        } catch (error) {
            console.error('Error saving projects:', error);
        }
    }
    
    updateProjectTitle() {
        const projectTitleEl = document.getElementById('project-title');
        const currentProject = this.getCurrentProject();
        
        if (currentProject) {
            // Update the H1 element
            projectTitleEl.textContent = currentProject.name;
            
            // Update the page title
            document.title = `${currentProject.name} - Flow Chart`;
        } else {
            projectTitleEl.textContent = 'New Project';
            document.title = 'Flow Chart';
        }
    }
    
    createNewProject() {
        const name = this.projectNameInput.value.trim();
        if (!name) return;
        
        const newProject = {
            id: 'project_' + Date.now(),
            name: name,
            dateCreated: new Date().toISOString(),
            dateModified: new Date().toISOString(),
            data: {
                boxes: [],
                connections: [],
                nextBoxId: 1,
                nextConnectionId: 1
            }
        };
        
        this.projects.push(newProject);
        this.saveProjects();
        this.hideNewProjectForm();
        this.renderProjectList();
        this.loadProject(newProject.id);
        this.updateProjectsVisibility();
    }
    
    renderProjectList() {
        // Clear existing projects except the "no projects" message
        const children = Array.from(this.projectListEl.children);
        children.forEach(child => {
            if (child !== this.noProjectsMessage) {
                child.remove();
            }
        });
        
        // Add project items
        this.projects.forEach(project => {
            const projectItem = document.createElement('div');
            // Add 'project-item' class and active if current project
            projectItem.className = 'project-item mb-2 rounded overflow-hidden';
            if (project.id === this.currentProjectId) {
                projectItem.classList.add('active');
            }
            projectItem.dataset.id = project.id;
            
            // Main project container
            const projectContainer = document.createElement('div');
            projectContainer.className = 'project-container p-2 flex justify-between items-center cursor-pointer group';
            
            // Check if this project is being edited
            if (this.editingProjectId === project.id) {
                // Render edit form
                projectContainer.innerHTML = `
                    <div class="flex w-full items-center">
                        <input type="text" class="flex-1 px-2 py-1 mr-2 border rounded" value="${project.name}" id="edit-${project.id}" style="border-color: var(--border-color); background-color: var(--bg-primary); color: var(--text-primary);">
                        <button class="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors text-green-600" data-id="${project.id}" title="Save">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors text-red-600 ml-1" data-id="${project.id}" title="Cancel">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                
                // Setup event listeners for the edit form
                const input = projectContainer.querySelector('input');
                const commitBtn = projectContainer.querySelector('button[title="Save"]');
                const cancelBtn = projectContainer.querySelector('button[title="Cancel"]');
                
                // Focus the input
                setTimeout(() => input.focus(), 0);
                
                // Commit on button click
                commitBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.commitProjectEdit(project.id, input.value);
                });
                
                // Cancel edit
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editingProjectId = null;
                    this.renderProjectList();
                });
                
                // Commit on Enter key
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.commitProjectEdit(project.id, input.value);
                    }
                });
                
                // Cancel on Escape key
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        this.editingProjectId = null;
                        this.renderProjectList();
                    }
                });
            }
            // Normal project display
            else {
                const dateModified = new Date(project.dateModified);
                const formattedDate = dateModified.toLocaleDateString();
                
                projectContainer.innerHTML = `
                    <div>
                        <div class="truncate">${project.name}</div>
                        <div class="text-xs opacity-60">Modified: ${formattedDate}</div>
                    </div>
                    <div class="flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <button class="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors" data-id="${project.id}" title="Edit">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors" data-id="${project.id}" title="Delete">
                            <i class="fas fa-trash-alt text-red-500"></i>
                        </button>
                    </div>
                `;
            }
            
            projectItem.appendChild(projectContainer);
            
            // Check if this project has a delete confirmation showing
            if (this.confirmingDeleteId === project.id) {
                // Create delete confirmation that slides down
                const confirmDelete = document.createElement('div');
                confirmDelete.className = 'p-2 flex items-center justify-between transition-all duration-200 overflow-hidden';
                confirmDelete.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                confirmDelete.innerHTML = `
                    <span class="text-sm">Confirm delete</span>
                    <div class="flex gap-2">
                        <button class="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors text-green-600" id="confirm-delete-${project.id}" title="Confirm">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors text-red-600" id="cancel-delete-${project.id}" title="Cancel">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                
                projectItem.appendChild(confirmDelete);
                
                // Add event listeners for confirmation buttons
                confirmDelete.querySelector(`#confirm-delete-${project.id}`).addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteProject(project.id);
                });
                
                confirmDelete.querySelector(`#cancel-delete-${project.id}`).addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.confirmingDeleteId = null;
                    this.renderProjectList();
                });
            }
            
            // Add click event to load project (only if not in edit mode)
            if (this.editingProjectId !== project.id) {
                projectContainer.addEventListener('click', (e) => {
                    // Don't load if clicking buttons
                    if (!e.target.closest('button')) {
                        this.loadProject(project.id);
                        this.hideSettingsMenu();
                    }
                });
                
                // Add event listeners for edit and delete buttons
                const editBtn = projectContainer.querySelector('button[title="Edit"]');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.startProjectEdit(project.id);
                    });
                }
                
                const deleteBtn = projectContainer.querySelector('button[title="Delete"]');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.confirmDeleteProject(project.id);
                    });
                }
            }
            
            this.projectListEl.appendChild(projectItem);
        });
        
        this.updateProjectsVisibility();
    }
    
    // Start editing a project name
    startProjectEdit(projectId) {
        this.editingProjectId = projectId;
        this.renderProjectList();
    }
    
    // Commit project name edit
    commitProjectEdit(projectId, newName) {
        newName = newName.trim();
        if (!newName) return;
        
        const projectIndex = this.projects.findIndex(p => p.id === projectId);
        if (projectIndex >= 0) {
            this.projects[projectIndex].name = newName;
            this.saveProjects();
            
            // Update title if editing current project
            if (projectId === this.currentProjectId) {
                this.updateProjectTitle();
            }
        }
        
        this.editingProjectId = null;
        this.renderProjectList();
    }
    
    // Show delete confirmation
    confirmDeleteProject(projectId) {
        this.confirmingDeleteId = projectId;
        this.renderProjectList();
    }
    
    updateProjectsVisibility() {
        if (this.projects.length === 0) {
            this.noProjectsMessage.style.display = 'block';
        } else {
            this.noProjectsMessage.style.display = 'none';
        }
    }
    
    deleteProject(projectId) {
        this.projects = this.projects.filter(project => project.id !== projectId);
        this.saveProjects();
        
        // If deleted current project, load another one
        if (projectId === this.currentProjectId) {
            if (this.projects.length > 0) {
                this.loadProject(this.projects[0].id);
            } else {
                // No projects left, clear diagram
                this.diagramManager.clearDiagram();
                this.currentProjectId = null;
                this.updateProjectTitle();
            }
        }
        
        this.confirmingDeleteId = null;
        this.renderProjectList();
        this.updateProjectsVisibility();
    }
    
    loadProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;
        
        // Save current project if exists
        this.saveCurrentProject();
        
        // Load new project
        this.currentProjectId = projectId;
        this.diagramManager.loadFromProjectData(project.data);
        
        // Update project title
        this.updateProjectTitle();
        
        localStorage.setItem('lastActiveProject', projectId);
    }
    
    saveCurrentProject() {
        if (!this.currentProjectId) return;
        
        const projectIndex = this.projects.findIndex(p => p.id === this.currentProjectId);
        if (projectIndex >= 0) {
            const diagramData = this.diagramManager.exportData();
            this.projects[projectIndex].data = diagramData;
            this.projects[projectIndex].dateModified = new Date().toISOString();
            this.saveProjects();
        }
    }
    
    getCurrentProject() {
        return this.projects.find(p => p.id === this.currentProjectId);
    }
}
