// --- ImportManager Class ---
class ImportManager {
    constructor(projectManager) {
        this.projectManager = projectManager;
        this.modal = this.createModal();
        document.body.appendChild(this.modal);
        this.setupEventListeners();
    }
    
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'import-projects-modal';
        modal.className = 'fixed inset-0 flex items-center justify-center z-50 hidden modal';
        
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 modal-backdrop" id="import-modal-backdrop"></div>
            <div class="rounded-lg shadow-xl z-10 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden modal-content" 
                 style="background-color: var(--bg-secondary); color: var(--text-primary);">
                <div class="px-4 py-3 border-b border-solid flex justify-between items-center" 
                     style="border-color: var(--border-color);">
                    <h3 class="text-lg font-semibold">Import Projects</h3>
                    <button id="close-import-modal" class="p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="p-4 flex flex-col">
                    <div class="mb-4">
                        <label class="block mb-2">Select JSON file containing projects:</label>
                        <input type="file" id="import-file-input" accept=".json" class="w-full p-2 border rounded"
                               style="border-color: var(--border-color); background-color: var(--bg-primary);">
                    </div>
                    
                    <div class="mb-4 hidden" id="import-projects-list-container">
                        <label class="block mb-2">Select projects to import:</label>
                        <div id="import-projects-list" class="border rounded p-2 max-h-48 overflow-y-auto"
                             style="border-color: var(--border-color); background-color: var(--bg-primary);">
                            <!-- Project checkboxes will be dynamically added here -->
                        </div>
                    </div>
                </div>
                
                <div class="px-4 py-3 border-t border-solid flex justify-end" 
                     style="border-color: var(--border-color);">
                    <button id="import-selected-projects" class="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        Import Selected
                    </button>
                </div>
            </div>
        `;
        
        return modal;
    }
    
    setupEventListeners() {
        const modal = this.modal;
        const backdrop = modal.querySelector('#import-modal-backdrop');
        const closeButton = modal.querySelector('#close-import-modal');
        const fileInput = modal.querySelector('#import-file-input');
        const importButton = modal.querySelector('#import-selected-projects');
        
        // Close modal when clicking backdrop or close button
        backdrop.addEventListener('click', () => this.closeModal());
        closeButton.addEventListener('click', () => this.closeModal());
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        
        // Handle import button click
        importButton.addEventListener('click', () => this.importSelectedProjects());
    }
    
    openModal() {
        this.modal.classList.remove('hidden');
        setTimeout(() => {
            this.modal.classList.add('open');
        }, 10);
    }
    
    closeModal() {
        const modal = this.modal;
        const fileInput = modal.querySelector('#import-file-input');
        const container = modal.querySelector('#import-projects-list-container');
        
        // Animate out
        modal.classList.remove('open');
        
        // Reset state
        fileInput.value = '';
        container.classList.add('hidden');
        
        // Hide modal after animation
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
    
    handleFileSelection(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    this.displayImportProjects(importedData);
                } else {
                    alert('Invalid project file format');
                }
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Error parsing file: ' + error.message);
            }
        };
        
        reader.readAsText(file);
    }
    
    displayImportProjects(importedProjects) {
        const modal = this.modal;
        const container = modal.querySelector('#import-projects-list-container');
        const projectsList = modal.querySelector('#import-projects-list');
        const importButton = modal.querySelector('#import-selected-projects');
        
        // Show the projects list container
        container.classList.remove('hidden');
        
        // Clear previous list
        projectsList.innerHTML = '';
        
        // Get current projects for comparison
        const currentProjects = this.projectManager.projects;
        const currentProjectsMap = new Map();
        currentProjects.forEach(project => {
            currentProjectsMap.set(project.name, project);
        });
        
        // Flag to track if any projects are available for import
        let hasSelectableProjects = false;
        
        // Add checkboxes for each project
        importedProjects.forEach(project => {
            const listItem = document.createElement('div');
            listItem.className = 'flex items-center p-1 border-b last:border-b-0';
            listItem.style.borderColor = 'var(--border-color)';
            
            const isConflict = currentProjectsMap.has(project.name);
            let isNewer = false;
            let shouldSelect = true;
            
            if (isConflict) {
                const currentProject = currentProjectsMap.get(project.name);
                isNewer = new Date(project.dateModified) > new Date(currentProject.dateModified);
                shouldSelect = isNewer;
                
                // Apply color based on date comparison
                listItem.style.color = isNewer ? 'var(--theme-green-text)' : 'var(--theme-red-text)';
            }
            
            // Format date
            const modifiedDate = new Date(project.dateModified).toLocaleDateString();
            
            listItem.innerHTML = `
                <label class="flex items-center w-full cursor-pointer">
                    <input type="checkbox" class="mr-2 import-project-checkbox" value="${project.id}" 
                           data-name="${project.name}" ${shouldSelect ? 'checked' : ''}>
                    <div class="flex-1">
                        <div class="font-medium">${project.name}</div>
                        <div class="text-xs opacity-70">Modified: ${modifiedDate}</div>
                        ${isConflict ? `<div class="text-xs font-medium">
                            ${isNewer ? '(Newer than existing project)' : '(Older than existing project)'}
                        </div>` : ''}
                    </div>
                </label>
            `;
            
            projectsList.appendChild(listItem);
            hasSelectableProjects = true;
        });
        
        // Enable/disable import button
        importButton.disabled = !hasSelectableProjects;
        
        if (!hasSelectableProjects) {
            projectsList.innerHTML = '<div class="p-2 text-center text-gray-500">No projects available to import</div>';
        }
    }
    
    importSelectedProjects() {
        const modal = this.modal;
        const checkboxes = modal.querySelectorAll('.import-project-checkbox:checked');
        const fileInput = modal.querySelector('#import-file-input');
        
        if (checkboxes.length === 0 || !fileInput.files[0]) {
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedProjects = JSON.parse(event.target.result);
                if (!Array.isArray(importedProjects)) {
                    throw new Error('Invalid project format');
                }
                
                // Get selected project IDs
                const selectedIds = Array.from(checkboxes).map(cb => cb.value);
                
                // Filter projects to only selected ones
                const projectsToImport = importedProjects.filter(project => 
                    selectedIds.includes(project.id));
                
                // Create a map of existing project names for comparison
                const existingProjectNames = new Map();
                this.projectManager.projects.forEach(project => {
                    existingProjectNames.set(project.name, project);
                });
                
                // Import projects, replacing any with the same name
                projectsToImport.forEach(project => {
                    // If project with same name exists, remove it
                    if (existingProjectNames.has(project.name)) {
                        const existingProject = existingProjectNames.get(project.name);
                        const existingIndex = this.projectManager.projects.findIndex(p => p.id === existingProject.id);
                        if (existingIndex >= 0) {
                            this.projectManager.projects.splice(existingIndex, 1);
                        }
                    }
                    
                    // Re-key if the imported id collides with a *different*
                    // surviving project: every lookup (loadProject,
                    // saveCurrentProject, lastActiveProject) resolves ids via
                    // first-match, so a duplicate id makes saves silently write
                    // into the wrong project.
                    if (this.projectManager.projects.some(p => p.id === project.id)) {
                        project.id = 'project_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                    }

                    // Add the imported project
                    this.projectManager.projects.push(project);
                });
                
                // Save and update UI
                this.projectManager.saveProjects();
                this.projectManager.renderProjectList();
                
                // Close modal and show success message
                this.closeModal();
                alert(`Successfully imported ${projectsToImport.length} project(s)`);
                
            } catch (error) {
                console.error('Error importing projects:', error);
                alert('Error importing projects: ' + error.message);
            }
        };
        
        reader.readAsText(fileInput.files[0]);
    }
}
