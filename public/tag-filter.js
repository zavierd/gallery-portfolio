// 标签筛选模块
class TagFilter {
    constructor(onTagSelect) {
        this.onTagSelect = onTagSelect;
        this.currentTag = 'all';
        this.tagContainer = null;
    }

    // 创建标签筛选器
    createTagFilter(categories) {
        this.tagContainer = document.createElement('div');
        this.tagContainer.className = 'tag-filter';
        
        // 使用文档片段提高性能
        const fragment = document.createDocumentFragment();
        
        // 添加鼠标滚轮事件 (Horizontal scroll via vertical wheel)
        this.tagContainer.addEventListener('wheel', (event) => {
            if (event.deltaY !== 0) {
                event.preventDefault();
                this.tagContainer.scrollLeft += event.deltaY;
            }
        });
    
        // 辅助函数：将选中的标签滚动到中间
        const centerTagButton = (btn) => {
            const containerWidth = this.tagContainer.clientWidth;
            const btnOffsetLeft = btn.offsetLeft;
            const btnWidth = btn.clientWidth;
            const scrollTarget = btnOffsetLeft - (containerWidth / 2) + (btnWidth / 2);
            this.tagContainer.scrollTo({ left: scrollTarget, behavior: 'smooth' });
        };
    
        // 添加"全部"标签
        const allTag = document.createElement('button');
        allTag.className = 'tag active'; // Default active
        allTag.textContent = '全部';
        allTag.dataset.value = 'all';
        
        allTag.addEventListener('click', () => {
            this.selectTag(allTag, 'all');
            centerTagButton(allTag);
        });
        fragment.appendChild(allTag);
    
        // 过滤掉 'all' 和 '0_preview' 标签，并按字母顺序排序
        const filteredCategories = categories.filter(category => 
            category !== 'all' && category !== '0_preview'
        ).sort();
        
        // 添加其他标签
        filteredCategories.forEach(category => {
            const tagButton = document.createElement('button');
            tagButton.className = 'tag';
            tagButton.textContent = category;
            tagButton.dataset.value = category;
            
            tagButton.addEventListener('click', () => {
                this.selectTag(tagButton, category);
                centerTagButton(tagButton);
            });
            fragment.appendChild(tagButton);
        });
    
        // 一次性添加所有标签
        this.tagContainer.appendChild(fragment);
    
        // 插入到gallery之前
        const gallery = document.querySelector('.gallery');
        if (gallery && gallery.parentNode) {
            gallery.parentNode.insertBefore(this.tagContainer, gallery);
        } else {
            document.body.appendChild(this.tagContainer);
        }
    }

    // 选择标签
    selectTag(selectedButton, tag) {
        // 移除所有标签的选中样式
        const buttons = this.tagContainer.querySelectorAll('.tag');
        buttons.forEach(t => t.classList.remove('active'));
        
        // 设置当前标签的选中样式
        selectedButton.classList.add('active');
        
        this.currentTag = tag;
        this.onTagSelect(tag);
    }

    // 获取当前选中的标签
    getCurrentTag() {
        return this.currentTag;
    }

    // 根据标签值选择标签
    selectTagByValue(tagValue) {
        if (!this.tagContainer) {
            console.error('tagContainer未初始化');
            return;
        }
        
        const tagButtons = this.tagContainer.querySelectorAll('.tag');
        for (const button of tagButtons) {
            if (button.dataset.value === tagValue || button.textContent === tagValue) {
                this.selectTag(button, tagValue);
                
                // Center the button
                const containerWidth = this.tagContainer.clientWidth;
                const btnOffsetLeft = button.offsetLeft;
                const btnWidth = button.clientWidth;
                const scrollTarget = btnOffsetLeft - (containerWidth / 2) + (btnWidth / 2);
                this.tagContainer.scrollTo({ left: scrollTarget, behavior: 'smooth' });
                break;
            }
        }
    }

    // 销毁标签筛选器
    destroy() {
        if (this.tagContainer && this.tagContainer.parentNode) {
            this.tagContainer.parentNode.removeChild(this.tagContainer);
        }
    }
}

// 导出为全局变量
window.TagFilter = TagFilter;
