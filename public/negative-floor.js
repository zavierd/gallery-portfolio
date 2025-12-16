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
        this.threshold = 150; // Pull threshold to open
        
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
        // Only trigger if at top of page and not already open
        if (window.scrollY <= 0 && !this.isOpen) {
            this.startY = e.touches[0].clientY;
            this.isDragging = true;
        }
    }

    handleTouchMove(e) {
        if (!this.isDragging) return;
        
        const y = e.touches[0].clientY;
        const diff = y - this.startY;
        
        // Only allow pulling down
        if (diff > 0) {
            // Add resistance
            this.currentY = Math.pow(diff, 0.8);
            
            // If dragging down, prevent default scrolling
            if (e.cancelable) e.preventDefault();
            
            this.updatePosition(this.currentY);
        }
    }

    handleTouchEnd(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        if (this.currentY > this.threshold) {
            this.open();
        } else {
            this.close();
        }
        
        this.currentY = 0;
    }

    updatePosition(y) {
        // We translate the negative floor down
        // It starts at -100% (-window.innerHeight)
        // So we add y to that
        if (!this.isOpen) {
            this.container.style.transform = `translateY(${y - this.container.offsetHeight}px)`;
            this.container.style.transition = 'none';
        }
    }

    open() {
        this.isOpen = true;
        this.container.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
        this.container.style.transform = 'translateY(0)';
        document.body.style.overflow = 'hidden'; // Lock scroll
        this.renderTags(this.gallery.availableCategories || []);
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

    renderTags(tags) {
        this.tagContainer.innerHTML = '';
        
        // Always add "All" tag
        this.createTagElement('全部', 'all');
        
        tags.forEach(tag => {
            this.createTagElement(tag, tag);
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
        
        tagEl.onclick = () => {
            this.gallery.tagFilter.selectTagByValue(value);
            this.gallery.imageLoader.filterImages(value);
            this.gallery.updateUrlForTag(value);
            this.close();
        };
        
        this.tagContainer.appendChild(tagEl);
    }

    handleSearch(query) {
        const tags = this.tagContainer.getElementsByClassName('nf-tag');
        const lowerQuery = query.toLowerCase();
        
        Array.from(tags).forEach(tag => {
            const text = tag.textContent.toLowerCase();
            if (text.includes(lowerQuery)) {
                tag.style.display = 'flex';
            } else {
                tag.style.display = 'none';
            }
        });
    }
}

window.NegativeFloor = NegativeFloor;
