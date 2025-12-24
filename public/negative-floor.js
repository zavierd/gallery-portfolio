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
        
        // 阻止负一楼内的触摸事件冒泡到瀑布流
        this.container.addEventListener('touchstart', (e) => {
            if (this.isOpen) e.stopPropagation();
        }, { passive: true });
        this.container.addEventListener('touchmove', (e) => {
            if (this.isOpen) e.stopPropagation();
        }, { passive: true });
        
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
        if (this.isOpen) {
            const isInput = target.tagName === 'INPUT';
            const isCloseBtn = target.closest('#nf-close-btn');
            
            if (!isInput && !isCloseBtn) {
                this.startY = y;
                this.isDragging = false; // 不立即开始拖动，等待判断
                this.dragMode = 'close';
                this.scrollStartY = this.tagContainer.scrollTop;
            }
        }
    }

    handleTouchMove(e) {
        const y = e.touches[0].clientY;
        const diff = y - this.startY;
        
        // Handling Opening (Pull Down)
        if (this.dragMode === 'open' && this.isDragging) {
            if (diff > 0) {
                this.currentY = Math.pow(diff, 0.8);
                if (e.cancelable) e.preventDefault();
                this.updatePosition(this.currentY - this.container.offsetHeight);
            }
        }
        
        // Handling Closing (Pull Up)
        if (this.dragMode === 'close') {
            const scrollTop = this.tagContainer.scrollTop;
            const scrollHeight = this.tagContainer.scrollHeight;
            const clientHeight = this.tagContainer.clientHeight;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
            
            // 上滑（diff < 0）
            if (diff < 0) {
                // 如果已经在底部，开始拖动关闭
                if (isAtBottom) {
                    if (!this.isDragging) {
                        this.isDragging = true;
                        this.startY = y; // 重置起始点
                        this.currentY = 0;
                    } else {
                        this.currentY = y - this.startY;
                        if (e.cancelable) e.preventDefault();
                        this.updatePosition(this.currentY);
                    }
                }
                // 否则让内容正常滚动
            }
            // 下滑（diff > 0）时不干预，让内容正常滚动
        }
    }

    handleTouchEnd(e) {
        if (this.dragMode === 'open' && this.isDragging) {
            if (this.currentY > this.threshold) {
                this.open();
            } else {
                this.close();
            }
        } else if (this.dragMode === 'close' && this.isDragging) {
            if (this.currentY < -this.threshold) {
                this.close();
            } else {
                this.open(); // Snap back to open
            }
        }
        
        this.isDragging = false;
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
        
        // 全部按钮
        const allTag = this.createTagElement('全部', 'all');
        allTag.classList.add('nf-tag-primary');
        this.tagContainer.appendChild(allTag);
        
        // 遍历一级分类
        categories.forEach(cat => {
            if (typeof cat === 'string') {
                this.tagContainer.appendChild(this.createTagElement(cat, cat));
                return;
            }
            
            // 一级分类区块
            const section = document.createElement('div');
            section.className = 'nf-section';
            
            // 一级标题
            const h1 = document.createElement('div');
            h1.className = 'nf-h1';
            h1.textContent = cat.name;
            h1.onclick = () => this.selectTag(cat.name);
            if (this.gallery.tagFilter?.currentTag === cat.name) h1.classList.add('active');
            section.appendChild(h1);
            
            // 二级分类
            if (cat.children && cat.children.length > 0) {
                const list = document.createElement('div');
                list.className = 'nf-list';
                
                cat.children.forEach(l2 => {
                    const l2Name = l2.name || l2;
                    const hasL3 = l2.children && l2.children.length > 0;
                    
                    // 二级项
                    const item = document.createElement('div');
                    item.className = 'nf-item';
                    
                    // 二级标题
                    const h2 = document.createElement('div');
                    h2.className = 'nf-h2';
                    h2.textContent = l2Name;
                    h2.onclick = () => this.selectTag(l2Name);
                    if (this.gallery.tagFilter?.currentTag === l2Name) h2.classList.add('active');
                    item.appendChild(h2);
                    
                    // 三级标签
                    if (hasL3) {
                        const tags = document.createElement('div');
                        tags.className = 'nf-tags';
                        this.renderDeepTags(l2.children, tags);
                        item.appendChild(tags);
                    }
                    
                    list.appendChild(item);
                });
                
                section.appendChild(list);
            }
            
            this.tagContainer.appendChild(section);
        });
    }
    
    renderDeepTags(children, container) {
        children.forEach(child => {
            const name = child.name || child;
            const tag = this.createTagElement(name, name);
            tag.classList.add('nf-tag-small');
            container.appendChild(tag);
            if (child.children?.length) this.renderDeepTags(child.children, container);
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
