// --- ExportManager Class ---
class ExportManager {
    constructor(projectManager) {
        this.projectManager = projectManager;
        this.modal = this.createModal();
        document.body.appendChild(this.modal);
        this.setupEventListeners();
    }
    
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'export-projects-modal';
        modal.className = 'fixed inset-0 flex items-center justify-center z-50 hidden modal';
        
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 modal-backdrop" id="export-modal-backdrop"></div>
            <div class="rounded-lg shadow-xl z-10 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden modal-content" 
                 style="background-color: var(--bg-secondary); color: var(--text-primary);">
                <div class="px-4 py-3 border-b border-solid flex justify-between items-center" 
                     style="border-color: var(--border-color);">
                    <h3 class="text-lg font-semibold">Export Projects</h3>
                    <button id="close-export-modal" class="p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="p-4 flex flex-col">
                    <div class="mb-4">
                        <label class="block mb-2">Select projects to export:</label>
                        <div id="export-projects-list" class="border rounded p-2 max-h-48 overflow-y-auto"
                             style="border-color: var(--border-color); background-color: var(--bg-primary);">
                            <!-- Project checkboxes will be dynamically added here -->
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block mb-2" for="export-filename">Filename:</label>
                        <input type="text" id="export-filename" class="w-full p-2 border rounded" value="flowchart-projects.json"
                               style="border-color: var(--border-color); background-color: var(--bg-primary);">
                    </div>
                </div>
                
                <div class="px-4 py-3 border-t border-solid flex justify-end" 
                     style="border-color: var(--border-color);">
                    <button id="export-selected-projects" class="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed">
                        Export Selected
                    </button>
                </div>
            </div>
        `;
        
        return modal;
    }
    
    setupEventListeners() {
        const modal = this.modal;
        const backdrop = modal.querySelector('#export-modal-backdrop');
        const closeButton = modal.querySelector('#close-export-modal');
        const exportButton = modal.querySelector('#export-selected-projects');
        
        // Close modal when clicking backdrop or close button
        backdrop.addEventListener('click', () => this.closeModal());
        closeButton.addEventListener('click', () => this.closeModal());
        
        // Handle export button click
        exportButton.addEventListener('click', () => this.exportSelectedProjects());
    }
    
    openModal() {
        this.populateProjectsList();
        
        this.modal.classList.remove('hidden');
        setTimeout(() => {
            this.modal.classList.add('open');
        }, 10);
    }
    
    closeModal() {
        this.modal.classList.remove('open');
        
        // Hide modal after animation
        setTimeout(() => {
            this.modal.classList.add('hidden');
        }, 300);
    }
    
    populateProjectsList() {
        const modal = this.modal;
        const projectsList = modal.querySelector('#export-projects-list');
        const exportButton = modal.querySelector('#export-selected-projects');
        
        // Clear previous list
        projectsList.innerHTML = '';
        
        // Get current projects
        const projects = this.projectManager.projects;
        
        // Add checkboxes for each project
        if (projects.length > 0) {
            // Add "Select All" checkbox
            const selectAllContainer = document.createElement('div');
            selectAllContainer.className = 'flex items-center p-1 bg-black bg-opacity-5 sticky top-0 border-b';
            selectAllContainer.style.borderColor = 'var(--border-color)';
            
            selectAllContainer.innerHTML = `
                <label class="flex items-center w-full cursor-pointer">
                    <input type="checkbox" id="select-all-export" class="mr-2" checked>
                    <div class="font-medium">Select All</div>
                </label>
            `;
            
            projectsList.appendChild(selectAllContainer);
            
            // Add event listener for select all
            modal.querySelector('#select-all-export').addEventListener('change', function() {
                const checkboxes = modal.querySelectorAll('.export-project-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = this.checked;
                });
            });
            
            // Add project items
            projects.forEach(project => {
                const modifiedDate = new Date(project.dateModified).toLocaleDateString();
                
                const listItem = document.createElement('div');
                listItem.className = 'flex items-center p-1 border-b last:border-b-0';
                listItem.style.borderColor = 'var(--border-color)';
                
                listItem.innerHTML = `
                    <label class="flex items-center w-full cursor-pointer">
                        <input type="checkbox" class="mr-2 export-project-checkbox" value="${project.id}" checked>
                        <div class="flex-1">
                            <div class="font-medium">${project.name}</div>
                            <div class="text-xs opacity-70">Modified: ${modifiedDate}</div>
                        </div>
                    </label>
                `;
                
                projectsList.appendChild(listItem);
            });
            
            // Enable export button
            exportButton.disabled = false;
        } else {
            projectsList.innerHTML = '<div class="p-2 text-center text-gray-500">No projects available to export</div>';
            exportButton.disabled = true;
        }
    }
    
    exportSelectedProjects() {
        const modal = this.modal;
        const checkboxes = modal.querySelectorAll('.export-project-checkbox:checked');
        
        if (checkboxes.length === 0) {
            alert('Please select at least one project to export');
            return;
        }
        
        // Get selected project IDs
        const selectedIds = Array.from(checkboxes).map(cb => cb.value);
        
        // Get projects from projectManager
        const selectedProjects = this.projectManager.projects.filter(project => 
            selectedIds.includes(project.id));
        
        // Create JSON data
        const jsonData = JSON.stringify(selectedProjects, null, 2);
        
        // Get filename
        const filenameInput = modal.querySelector('#export-filename');
        let filename = filenameInput.value.trim();
        if (!filename) {
            filename = 'flowchart-projects.json';
        } else if (!filename.toLowerCase().endsWith('.json')) {
            filename += '.json';
        }
        
        // Create download link
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonData);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', filename);
        document.body.appendChild(downloadAnchor);
        
        // Trigger download
        downloadAnchor.click();
        
        // Clean up
        document.body.removeChild(downloadAnchor);
        
        // Close modal
        this.closeModal();
    }
}
