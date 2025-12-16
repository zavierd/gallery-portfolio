class NegativeFloor {
    constructor(gallery) {
        this.gallery = gallery;
        this.container = document.getElementById('negative-floor');
        this.searchInput = document.getElementById('nf-search-input');
        this.tagContainer = document.getElementById('nf-tag-grid');
        this.closeBtn = document.getElementById('nf-close-btn');
        
        this.isOpen = false;
        this.startY = 0;
        this.currentY = 0;
        this.threshold = 80; // Pull threshold to open
        
        this.init();
    }

    init() {
        this.bindEvents();
        // Prevent native pull-to-refresh
        document.body.style.overscrollBehaviorY = 'contain';
    }

    bindEvents() {
        // Touch events for pulling
        window.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        window.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        window.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Search functionality
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        
        // Close button
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
    }

    handleTouchStart(e) {
        const y = e.touches[0].clientY;
        const target = e.target;
        
        // Scenario 1: Opening (Pull Down)
        // Only trigger if at top of page and not already open
        if (!this.isOpen && window.scrollY <= 0) {
            this.startY = y;
            this.isDragging = true;
            this.dragMode = 'open';
        }
        
        // Scenario 2: Closing (Pull Up)
        // Only trigger if already open
        // CRITICAL: Only allow closing via dragging the HEADER or empty space, 
        // to prevent conflict with scrolling the tag list and clicking tags/inputs.
        if (this.isOpen) {
             const isHeader = target.closest('.nf-header');
             const isInput = target.tagName === 'INPUT';
             const isCloseBtn = target.closest('#nf-close-btn');
             
             // Also allow if we are at the very top of scroll content and pulling up? 
             // No, that's where conflict happens. 
             // Let's restrict to Header for "Pull Up to Close" to ensure content is interactive.
             
             // IMPORTANT: Exclude input and buttons from drag start to allow focus/click
             if (isHeader && !isInput && !isCloseBtn) {
                 this.startY = y;
                 this.isDragging = true;
                 this.dragMode = 'close';
             }
        }
    }

    handleTouchMove(e) {
        if (!this.isDragging) return;
        
        const y = e.touches[0].clientY;
        const diff = y - this.startY;
        
        // Handling Opening (Pull Down)
        if (this.dragMode === 'open') {
            if (diff > 0) {
                // Add resistance
                this.currentY = Math.pow(diff, 0.8);
                if (e.cancelable) e.preventDefault();
                this.updatePosition(this.currentY - this.container.offsetHeight);
            }
        }
        
        // Handling Closing (Pull Up)
        if (this.dragMode === 'close') {
            if (diff < 0) {
                 // No resistance needed for closing usually, or maybe slight
                 this.currentY = diff; // Negative value
                 if (e.cancelable) e.preventDefault();
                 // We translate from 0 to negative
                 this.updatePosition(this.currentY);
            }
        }
    }

    handleTouchEnd(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        if (this.dragMode === 'open') {
            if (this.currentY > this.threshold) {
                this.open();
            } else {
                this.close();
            }
        } else if (this.dragMode === 'close') {
            // If pulled up enough (negative value), close it
            if (this.currentY < -this.threshold) {
                this.close();
            } else {
                this.open(); // Snap back to open
            }
        }
        
        this.currentY = 0;
        this.dragMode = null;
    }

    updatePosition(y) {
        this.container.style.transform = `translateY(${y}px)`;
        this.container.style.transition = 'none';
    }

    open() {
        this.isOpen = true;
        this.container.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
        this.container.style.transform = 'translateY(0)';
        document.body.style.overflow = 'hidden'; // Lock scroll
        
        // Pass hierarchical data if available, else flat
        const categories = this.gallery.categoriesRaw || this.gallery.availableCategories || [];
        this.renderTags(categories);
    }

    close() {
        this.isOpen = false;
        this.container.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
        this.container.style.transform = 'translateY(-100%)';
        document.body.style.overflow = ''; // Unlock scroll
        
        // Reset search
        this.searchInput.value = '';
        this.handleSearch('');
    }

    renderTags(categories) {
        this.tagContainer.innerHTML = '';
        
        // Create "All" section at the top (optional, but good for UX)
        // Or just a standalone "All" button
        const allGroup = document.createElement('div');
        allGroup.className = 'nf-group';
        const allTags = document.createElement('div');
        allTags.className = 'nf-group-tags';
        
        const allTagEl = this.createTagElement('全部', 'all');
        allTags.appendChild(allTagEl);
        allGroup.appendChild(allTags);
        this.tagContainer.appendChild(allGroup);
        
        // Iterate categories
        categories.forEach(cat => {
            // If it's just a string (fallback), treat as simple tag
            if (typeof cat === 'string') {
                const tagEl = this.createTagElement(cat, cat);
                // Append to 'allTags' or create new? Let's just create a generic group if mixed.
                // Assuming consistent data structure now.
                // If it's mixed string, we append to a generic container? 
                // Let's stick to the tree structure we expect: { name, children }
                return;
            }
            
            // It's an object { name, children }
            const group = document.createElement('div');
            group.className = 'nf-group';
            
            // Level 1 Title (Clickable)
            const title = document.createElement('div');
            title.className = 'nf-group-title';
            title.textContent = cat.name;
            title.onclick = () => {
                this.selectTag(cat.name);
            };
            
            // Check if active (if level 1 tag is selected)
            if (this.gallery.tagFilter && this.gallery.tagFilter.currentTag === cat.name) {
                title.classList.add('active');
            }
            
            group.appendChild(title);
            
            // Level 2 Tags
            if (cat.children && cat.children.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.className = 'nf-group-tags';
                
                cat.children.forEach(child => {
                    // Child can be string or object? Assuming object {name} based on flattenCategories
                    const childName = child.name || child;
                    const tagEl = this.createTagElement(childName, childName);
                    tagsContainer.appendChild(tagEl);
                });
                
                group.appendChild(tagsContainer);
            }
            
            this.tagContainer.appendChild(group);
        });
    }

    createTagElement(displayText, value) {
        const tagEl = document.createElement('div');
        tagEl.className = 'nf-tag';
        tagEl.textContent = displayText;
        
        // Check if active
        if (this.gallery.tagFilter && this.gallery.tagFilter.currentTag === value) {
            tagEl.classList.add('active');
        }
        
        tagEl.onclick = (e) => {
            e.stopPropagation(); // Prevent bubbling if needed
            this.selectTag(value);
        };
        
        return tagEl;
    }
    
    selectTag(value) {
        this.gallery.tagFilter.selectTagByValue(value);
        this.gallery.imageLoader.filterImages(value);
        this.gallery.updateUrlForTag(value);
        this.close();
    }

    handleSearch(query) {
        const lowerQuery = query.toLowerCase();
        const groups = this.tagContainer.getElementsByClassName('nf-group');
        
        Array.from(groups).forEach(group => {
            const title = group.querySelector('.nf-group-title');
            const tags = group.querySelectorAll('.nf-tag');
            let hasVisibleTags = false;
            
            // Check title
            let titleVisible = false;
            if (title) {
                const titleText = title.textContent.toLowerCase();
                if (titleText.includes(lowerQuery)) {
                    titleVisible = true;
                }
            }
            
            // Check tags
            tags.forEach(tag => {
                const text = tag.textContent.toLowerCase();
                if (text.includes(lowerQuery)) {
                    tag.style.display = 'inline-flex';
                    hasVisibleTags = true;
                } else {
                    tag.style.display = 'none';
                }
            });
            
            // Visibility logic:
            // If title matches, show group and all tags? Or just title?
            // Usually if title matches, we might want to show the whole group or just the title.
            // Let's say if title matches, we show the title.
            // If tags match, we show the tags.
            // If neither, hide group.
            
            // Revised: 
            // If query is empty, show everything.
            if (!lowerQuery) {
                group.style.display = 'block';
                if (title) title.style.display = 'block';
                tags.forEach(t => t.style.display = 'inline-flex');
                return;
            }
            
            if (titleVisible || hasVisibleTags) {
                group.style.display = 'block';
                // If title matched, show it. If not, but tags matched, maybe show title as context?
                // Let's always show title if any child matches, for context.
                if (title) title.style.display = 'block'; 
            } else {
                group.style.display = 'none';
            }
        });
    }
}

window.NegativeFloor = NegativeFloor;
