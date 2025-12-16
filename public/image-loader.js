// 图片加载模块
class ImageLoader {
    constructor(galleryElement, dataLoader) {
        this.galleryElement = galleryElement;
        this.dataLoader = dataLoader;
        this.columns = 3;
        this.imagesPerLoad = 10;
        this.currentIndex = 0;
        this.imagesLoadedCount = 0;
        this.loadingImagesCount = 0;
        this.columnElements = [];
        this.columnHeights = []; // Track virtual heights based on aspect ratio
        this.currentTag = 'all';
        this.isScrollLoading = false;
        this.scrollThrottleTimer = null;
        this.lastScrollY = window.scrollY;
        this.scrollDelta = 0;
        this.loadingImages = [];
        this.loadedImageUrls = new Set();
        this.currentHighResImage = null;
        this.isModalOpen = false;
        
        // Navigation state
        this.currentModalIndex = -1;
        this.touchStartX = 0;
        this.touchStartY = 0;
        
        this.init();
    }

    init() {
        this.createColumns();
        this.setupScrollListener();
        this.setupResizeListener();
    }

    // 创建列元素
    createColumns() {
        // 清空旧的列
        this.columnElements.forEach(column => {
            if (column.parentNode === this.galleryElement) {
                this.galleryElement.removeChild(column);
            }
        });
        this.columnElements = [];
        this.columnHeights = []; // 重置虚拟高度追踪
        
        for (let i = 0; i < this.columns; i++) {
            const column = document.createElement('div');
            column.classList.add('column');
            this.columnElements.push(column);
            this.galleryElement.appendChild(column);
            this.columnHeights.push(0); // 初始化高度为0
        }
    }

    // 获取最短列的索引
    getShortestColumn() {
        let minIndex = 0;
        let minHeight = this.columnHeights[0]; // 使用虚拟高度
        for (let i = 1; i < this.columnElements.length; i++) {
            if (this.columnHeights[i] < minHeight) {
                minHeight = this.columnHeights[i];
                minIndex = i;
            }
        }
        return minIndex;
    }

    // 更新列数及每次加载的图片数
    updateColumns() {
        const width = window.innerWidth;
        let computedColumns, computedImagesPerLoad;
        
        // 手机端4列，电脑端8列
        if (width < 768) {
            computedColumns = 4;
            computedImagesPerLoad = 16;
        } else {
            computedColumns = 8;
            computedImagesPerLoad = 32;
        }
        
        // 如果列数没有变化，仅更新加载图片数量，不重新排布
        if (computedColumns === this.columns) {
            this.imagesPerLoad = computedImagesPerLoad;
            return;
        }
        
        console.log(`调整列数: ${this.columns} -> ${computedColumns}`);
        
        // 记录现有图片
        const loadedImages = Array.from(document.querySelectorAll('.gallery img'));
        
        // 创建图片URL的集合，用于去重
        const imageUrlSet = new Set();
        
        // 根据原始顺序排序图片，并去除重复
        const uniqueImages = loadedImages.filter(img => {
            const originalUrl = img.getAttribute('data-original');
            if (imageUrlSet.has(originalUrl)) {
                if (img.parentNode) {
                    console.log('发现重复图片，删除:', originalUrl);
                    img.parentNode.removeChild(img);
                }
                return false;
            }
            imageUrlSet.add(originalUrl);
            return true;
        }).sort((a, b) => {
            const orderA = parseInt(a.dataset.originalOrder || 0);
            const orderB = parseInt(b.dataset.originalOrder || 0);
            return orderA - orderB;
        });
        
        console.log(`调整布局: 共有 ${loadedImages.length} 张图片，去重后 ${uniqueImages.length} 张`);
        
        // 更新全局变量
        this.columns = computedColumns;
        this.imagesPerLoad = computedImagesPerLoad;
        
        // 创建新列
        this.createColumns();
        
        // 重新分配图片
        this.distributeImagesInOriginalOrder(uniqueImages);
        
        // 更新其他设置
        setTimeout(() => {
            this.updateHoverEffects();
        }, 300);
        
        // 检查是否需要加载更多图片
        this.checkIfMoreImagesNeeded();
    }

    // 按照原始顺序分配图片
    distributeImagesInOriginalOrder(images) {
        if (images.length === 0) return;
        
        // 移除所有图片
        images.forEach(img => {
            if (img.parentNode) {
                img.parentNode.removeChild(img);
            }
        });
        
        // 创建图片URL的集合，用于最后一次检查去重
        const finalImageUrlSet = new Set();
        
        // 逐个将图片添加到最短的列，确保不会有重复
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const originalUrl = img.getAttribute('data-original');
            
            // 最后一次去重检查
            if (finalImageUrlSet.has(originalUrl)) {
                console.log('分配时发现重复图片，跳过:', originalUrl);
                continue;
            }
            finalImageUrlSet.add(originalUrl);
            
            // 如果图片没有原始序号，则添加一个
            if (!img.dataset.originalOrder) {
                img.dataset.originalOrder = i;
            }
            
            // 将图片添加到最短的列
            const shortestColumnIndex = this.getShortestColumn();
            this.columnElements[shortestColumnIndex].appendChild(img);
            
            // 更新虚拟高度 (假设宽度归一化为1，高度即为宽高比)
            const aspectRatio = img.naturalHeight / img.naturalWidth;
            if (!isNaN(aspectRatio)) {
                this.columnHeights[shortestColumnIndex] += aspectRatio;
            } else {
                this.columnHeights[shortestColumnIndex] += 1; // 默认正方形
            }
        }
    }

    // 检查是否需要加载更多图片
    checkIfMoreImagesNeeded() {
        // 检查当前内容高度是否填满屏幕
        const viewportHeight = window.innerHeight;
        const contentHeight = Math.max(...this.columnElements.map(col => col.offsetHeight || 0));
        
        // 如果内容不足以填满屏幕+额外两行，加载更多
        const rowHeight = 200; // 预估每行高度
        const requiredHeight = viewportHeight + (rowHeight * 2);

        console.log(`检查是否需要加载更多: 内容高度=${contentHeight}, 所需高度=${requiredHeight}`);
        
        if (contentHeight < requiredHeight) {
            const images = this.getCurrentImages();
            if (this.currentIndex < images.length) {
                setTimeout(() => {
                    this.loadNextImages(this.currentTag);
                }, 100);
            }
        }
    }

    // 获取当前标签的图片
    getCurrentImages() {
        if (this.currentTag === 'all') {
            return this.dataLoader.getAllImages();
        } else {
            return this.dataLoader.getImagesByCategory(this.currentTag);
        }
    }

    // 加载下一批图片
    loadNextImages(tag) {
        const images = this.getCurrentImages();
        
        // 检查是否还有更多图片需要加载
        if (this.currentIndex >= images.length) {
            this.handleAllImagesLoaded();
            return;
        }

        // 设置加载状态
        const isInitialLoad = this.currentIndex === 0;
        if (!isInitialLoad) {
            this.showLoadingMessage();
        }
        
        // 确保gallery可见 (Do not hide global loader here yet)
        if (this.galleryElement.style.opacity !== '1') {
            // Wait for images to load
        }
        
        // 计算需要加载的图片数量
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const headerHeight = 0;
        const availableHeight = viewportHeight - headerHeight;
        const imagesPerRow = this.columns;
        
        // 根据屏幕大小动态调整平均图片高度
        let avgImageHeight;
        if (viewportWidth < 600) {
            avgImageHeight = 180; // 手机端图片较小
        } else if (viewportWidth < 900) {
            avgImageHeight = 200; // 平板端
        } else if (viewportWidth < 1200) {
            avgImageHeight = 220; // 小桌面
        } else if (viewportWidth < 1500) {
            avgImageHeight = 240; // 大桌面
        } else {
            avgImageHeight = 260; // 超大屏幕
        }
        
        // 计算屏幕能显示多少行
        const rowsToFillScreen = Math.ceil(availableHeight / avgImageHeight);
        
        // 根据屏幕大小动态调整额外行数
        let additionalRows;
        if (viewportWidth < 600) {
            additionalRows = 3; // 手机端：更多预加载
        } else if (viewportWidth < 900) {
            additionalRows = 2; // 平板端：中等预加载
        } else if (viewportWidth < 1200) {
            additionalRows = 2; // 小桌面：中等预加载
        } else if (viewportWidth < 1500) {
            additionalRows = 1; // 大桌面：较少预加载
        } else {
            additionalRows = 1; // 超大屏幕：最少预加载
        }
        
        const totalRowsToLoad = rowsToFillScreen + additionalRows;
        const maxImagesToLoad = totalRowsToLoad * imagesPerRow;
        
        // 计算当前已加载的图片数量
        const loadedImagesCount = document.querySelectorAll('.gallery img').length;
        
        // 计算还需要加载多少图片
        let remainingToLoad = Math.max(imagesPerRow, maxImagesToLoad - loadedImagesCount);
        
        console.log(`准备加载图片: 屏幕=${viewportWidth}x${viewportHeight}, 列数=${imagesPerRow}, 平均高度=${avgImageHeight}, 当前已加载=${loadedImagesCount}, 目标总数=${maxImagesToLoad}, 还需加载=${remainingToLoad}`);
        
        // 单张图片加载计数器
        let loadedInThisBatch = 0;
        const batchStart = Date.now();
        
        // 递归加载单张图片
        const loadSingleImage = (index) => {
            // 检查是否完成加载
            if (index >= images.length || remainingToLoad <= 0) {
                if (!isInitialLoad) {
                    this.hideLoadingMessage();
                } else {
                    // Hide global loader and show gallery on first batch done
                    const globalLoader = document.getElementById('loading');
                    if (globalLoader) globalLoader.classList.add('hidden');
                    this.galleryElement.style.opacity = '1';
                }
                
                if (index >= images.length) {
                    console.log('所有图片已加载完毕');
                    this.handleAllImagesLoaded();
                } else {
                    console.log(`本批次加载完成，共加载 ${loadedInThisBatch} 张图片`);
                    this.preloadNextBatchImages();
                    this.checkIfMoreImagesNeeded();
                }
                
                // 重置滚动加载状态
                setTimeout(() => {
                    this.isScrollLoading = false;
                }, 200);
                
                return;
            }
            
            const imageData = images[index];
            const imageUrl = imageData.preview;
            const originalUrl = imageData.original;
            
            // 更严格的去重：检查缩略图和原图URL
            if (this.loadedImageUrls.has(imageUrl) || document.querySelector(`.gallery img[data-original="${originalUrl}"]`)) {
                console.log(`跳过已加载图片: ${imageUrl}`);
                this.currentIndex++;
                loadSingleImage(this.currentIndex);
                return;
            }
            
            // 图片加载
            const img = new Image();
            // 启用原生懒加载与异步解码
            //try { img.loading = 'lazy'; } catch (e) {}
            //try { img.decoding = 'async'; } catch (e) {}
            
            // 预览图缺失检测
            let previewFailed = false;
            
            img.onload = () => {
                if (tag !== this.currentTag) {
                    console.log(`tag已经切换：当前选中tag:${this.currentTag}，本请求tag:${tag}，跳过加载`);
                    return;
                }
                this.loadingImages.splice(this.loadingImages.indexOf(img), 1);
                
                try {
                    // 再次检查DOM中是否已存在此图片
                    if (document.querySelector(`.gallery img[data-original="${originalUrl}"]`)) {
                        console.log(`图片已存在于DOM中: ${originalUrl}`);
                        this.currentIndex++;
                        loadSingleImage(this.currentIndex);
                        return;
                    }
                    
                    // 添加到已加载集合
                    this.loadedImageUrls.add(imageUrl);
                    
                    // 添加到最短列
                    const shortestColumnIndex = this.getShortestColumn();
                    this.columnElements[shortestColumnIndex].appendChild(img);
                    
                    // 更新虚拟高度 (基于宽高比)
                    const aspectRatio = img.naturalHeight / img.naturalWidth;
                    if (!isNaN(aspectRatio)) {
                        this.columnHeights[shortestColumnIndex] += aspectRatio;
                    } else {
                        this.columnHeights[shortestColumnIndex] += 1;
                    }
                    
                    // 设置加载动画
                    setTimeout(() => {
                        img.classList.add('loaded');
                    }, 10);
                    
                    // 更新计数
                    this.currentIndex++;
                    this.imagesLoadedCount++;
                    remainingToLoad--;
                    loadedInThisBatch++;
                    
                    // 添加序号
                    img.dataset.originalOrder = this.currentIndex - 1;
                    
                    // 继续加载下一张图片
                    loadSingleImage(this.currentIndex);
                    
                } catch (error) {
                    console.error('处理图片加载时出错:', error);
                    this.currentIndex++;
                    loadSingleImage(this.currentIndex);
                }
            };
            
            img.onerror = () => {
                console.warn(`预览图加载失败: ${imageUrl}`);
                this.loadingImages.splice(this.loadingImages.indexOf(img), 1);
                
                // 如果预览图加载失败，尝试加载原图
                if (!previewFailed) {
                    previewFailed = true;
                    console.log(`尝试加载原图: ${originalUrl}`);
                    img.src = originalUrl;
                    return;
                }
                
                // 如果原图也加载失败，跳过这张图片
                console.error(`原图也加载失败，跳过: ${originalUrl}`);
                this.currentIndex++;
                loadSingleImage(this.currentIndex);
            };
            
            // 设置图片属性
            img.src = imageUrl;
            img.alt = imageData.name || 'Gallery Image';
            img.dataset.original = originalUrl;
            img.dataset.preview = imageUrl;
            img.dataset.category = imageData.category || 'unknown';
            
            // 添加到加载中列表
            this.loadingImages.push(img);
            
            // 添加点击事件
            const imgClickHandler = () => {
                this.openModal(originalUrl, imageUrl);
            };
            img.addEventListener('click', imgClickHandler);
            img.imgClickHandler = imgClickHandler;
        };
        
        // 开始加载第一张图片
        this.isScrollLoading = true;
        loadSingleImage(this.currentIndex);
    }

    // 显示加载消息
    showLoadingMessage() {
        if (!document.getElementById('temp-loading-msg')) {
            const tempLoadingMsg = document.createElement('div');
            tempLoadingMsg.id = 'temp-loading-msg';
            tempLoadingMsg.className = 'loading-dots';
            tempLoadingMsg.innerHTML = '<span></span><span></span><span></span>';
            this.galleryElement.after(tempLoadingMsg);
        }
    }

    // 隐藏加载消息
    hideLoadingMessage() {
        const tempMsg = document.getElementById('temp-loading-msg');
        if (tempMsg) tempMsg.remove();
    }

    // 预加载下一批图片
    preloadNextBatchImages() {
        const images = this.getCurrentImages();
        
        if (this.currentIndex >= images.length) return;
        
        // 根据屏幕大小和列数动态调整预加载数量
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 计算动态预加载数量
        let preloadCount;
        
        if (viewportWidth < 600) {
            // 手机端：预加载更多图片，确保滚动流畅
            const rowsToPreload = Math.ceil(viewportHeight / 200) + 2; // 屏幕高度对应的行数 + 2行
            preloadCount = this.columns * rowsToPreload;
        } else if (viewportWidth < 900) {
            // 平板端：中等预加载
            const rowsToPreload = Math.ceil(viewportHeight / 250) + 1;
            preloadCount = this.columns * rowsToPreload;
        } else if (viewportWidth < 1200) {
            // 小桌面：较少预加载
            const rowsToPreload = Math.ceil(viewportHeight / 300) + 1;
            preloadCount = this.columns * rowsToPreload;
        } else if (viewportWidth < 1500) {
            // 大桌面：更少预加载
            const rowsToPreload = Math.ceil(viewportHeight / 350) + 1;
            preloadCount = this.columns * rowsToPreload;
        } else {
            // 超大屏幕：最少预加载
            const rowsToPreload = Math.ceil(viewportHeight / 400) + 1;
            preloadCount = this.columns * rowsToPreload;
        }
        
        // 确保预加载数量在合理范围内
        preloadCount = Math.max(this.columns * 2, Math.min(preloadCount, this.columns * 8));
        
        const endIndex = Math.min(this.currentIndex + preloadCount, images.length);
        
        let preloadContainer = document.getElementById('preload-container');
        if (!preloadContainer) {
            preloadContainer = document.createElement('div');
            preloadContainer.id = 'preload-container';
            preloadContainer.style.display = 'none';
            document.body.appendChild(preloadContainer);
        }
        
        preloadContainer.innerHTML = '';
        
        for (let i = this.currentIndex; i < endIndex; i++) {
            const imageData = images[i];
            const preloadImg = new Image();
            preloadImg.src = imageData.preview;
            preloadContainer.appendChild(preloadImg);
        }
        
        console.log(`预加载了${endIndex - this.currentIndex}张图片 (屏幕: ${viewportWidth}x${viewportHeight}, 列数: ${this.columns}, 预加载: ${preloadCount})`);
    }

    // 处理所有图片加载完成
    handleAllImagesLoaded() {
        // 不显示加载完毕消息
        return;
    }

    // 设置滚动监听
    setupScrollListener() {
        window.addEventListener('scroll', () => {
            if (this.isScrollLoading) return;
            
            if (this.scrollThrottleTimer) return;
            
            this.scrollThrottleTimer = setTimeout(() => {
                this.scrollThrottleTimer = null;
                
                const currentScrollY = window.scrollY;
                this.scrollDelta = currentScrollY - this.lastScrollY;
                this.lastScrollY = currentScrollY;
                
                const documentHeight = document.documentElement.scrollHeight;
                const scrollPosition = window.scrollY + window.innerHeight;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // 根据屏幕大小动态调整滚动阈值
                let scrollThreshold;
                if (viewportWidth < 600) {
                    // 手机端：更早触发加载，确保流畅
                    scrollThreshold = viewportHeight * 0.8;
                } else if (viewportWidth < 900) {
                    // 平板端：中等阈值
                    scrollThreshold = viewportHeight * 0.6;
                } else if (viewportWidth < 1200) {
                    // 小桌面：较小阈值
                    scrollThreshold = viewportHeight * 0.5;
                } else if (viewportWidth < 1500) {
                    // 大桌面：更小阈值
                    scrollThreshold = viewportHeight * 0.4;
                } else {
                    // 超大屏幕：最小阈值
                    scrollThreshold = viewportHeight * 0.3;
                }
                
                const contentHeight = Math.max(...this.columnElements.map(col => col.offsetHeight || 0));
                const needsMoreContent = contentHeight < (viewportHeight + (2 * 200));
                
                if ((scrollPosition > documentHeight - scrollThreshold) || needsMoreContent) {
                    const images = this.getCurrentImages();
                    if (this.currentIndex < images.length && !this.isScrollLoading) {
                        console.log(`触发滚动加载: 滚动位置=${scrollPosition}, 文档高度=${documentHeight}, 阈值=${scrollThreshold}, 内容高度=${contentHeight}`);
                        this.isScrollLoading = true;
                        this.loadNextImages(this.currentTag);
                    }
                }
            }, 120);
        });
    }

    // 设置窗口大小变化监听
    setupResizeListener() {
        window.addEventListener('resize', () => {
            if (window.innerWidth !== this.lastWidth) {
                this.updateColumns();
                this.lastWidth = window.innerWidth;
                setTimeout(() => {
                    this.updateHoverEffects();
                }, 300);
            }
            this.setGalleryMarginTop();
        });
    }

    // 设置gallery的margin-top
    setGalleryMarginTop() {
        // 由于 tag-filter 现在是 position: sticky 并且 top: 0，
        // 且 index.html 中没有 header，
        // gallery 实际上会紧随 tag-filter 之后。
        // 但由于 sticky 元素占据空间，我们不需要额外的 margin-top，
        // 除非我们想要一些间距。
        // 之前的 headerHeight = 0 加 20px 可能导致了额外的空白，
        // 尤其是如果 tag-filter 本身就有 padding。
        
        // 我们将其设为 0，因为 gallery.css 中 .gallery 已经有了 padding: 20px
        this.galleryElement.style.marginTop = '0px';
    }

    // 更新悬停效果
    updateHoverEffects() {
        this.setupImageHoverEffects();
    }

    // 设置图片悬停效果
    setupImageHoverEffects() {
        if (window.hoverEffectObserver) {
            window.hoverEffectObserver.disconnect();
        }
        
        window.hoverEffectObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.tagName === 'IMG') {
                            this.addHoverEffect(node);
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll('img').forEach(img => this.addHoverEffect(img));
                        }
                    });
                }
            });
        });
        
        document.querySelectorAll('.gallery img').forEach(img => this.addHoverEffect(img));
        
        window.hoverEffectObserver.observe(this.galleryElement, {
            childList: true,
            subtree: true
        });
    }

    // 添加悬停效果
    addHoverEffect(img) {
        if (img.dataset.hoverInitialized) return;
        
        img.dataset.hoverInitialized = 'true';
        
        img.addEventListener('mouseenter', function() {
            this.classList.add('hover-active');
        });
        
        img.addEventListener('mouseleave', function() {
            this.classList.remove('hover-active');
        });
    }

    // 筛选图片
    filterImages(tag) {
        // 移除底部"已全部加载完成"的提示消息
        const loadedMsg = document.getElementById('all-loaded-message');
        if (loadedMsg) {
            loadedMsg.remove();
        }
        
        // 移除临时加载消息
        this.hideLoadingMessage();
        
        // 重置已加载图片集合
        this.loadedImageUrls.clear();
        
        // 取消正在加载中的图片
        this.loadingImages.forEach((img) => {
            img.src = "";
            img.onload = null;
            img.onerror = null;
            img.removeEventListener("click", img.imgClickHandler);
        });
        this.loadingImages = [];
        
        console.log(`标签切换到: ${tag}, 已清空已加载图片缓存`);

        this.currentTag = tag;
        this.currentIndex = 0;
        this.imagesLoadedCount = 0;
        this.loadingImagesCount = 0;
        
        // 清除所有列并重新创建
        this.createColumns();

        // 分页加载第一批图片
        this.loadNextImages(tag);
    }

    // 创建EXIF信息显示（提取为独立方法）
    createExifInfo(exifData) {
        if (!exifData) return '';
        
        let exifHtml = '<div class="exif-info">';
        
        // 基本信息
        if (exifData.aperture) {
            exifHtml += `<p><strong>光圈:</strong> f/${exifData.aperture}</p>`;
        }
        if (exifData.shutterSpeed) {
            exifHtml += `<p><strong>快门:</strong> ${exifData.shutterSpeed}s</p>`;
        }
        if (exifData.iso) {
            exifHtml += `<p><strong>ISO:</strong> ${exifData.iso}</p>`;
        }
        if (exifData.focalLength) {
            exifHtml += `<p><strong>焦距:</strong> ${exifData.focalLength}mm</p>`;
        }
        if (exifData.camera) {
            exifHtml += `<p><strong>相机:</strong> ${exifData.camera}</p>`;
        }
        if (exifData.lens) {
            exifHtml += `<p><strong>镜头:</strong> ${exifData.lens}</p>`;
        }
        
        // 地理位置信息
        if (exifData.gps) {
            exifHtml += `<p><strong>位置:</strong> ${exifData.gps}</p>`;
        }
        
        // 拍摄时间
        if (exifData.dateTime) {
            exifHtml += `<p><strong>拍摄时间:</strong> ${exifData.dateTime}</p>`;
        }
        
        exifHtml += '</div>';
        return exifHtml;
    }

    // 打开模态窗口
    openModal(original, preview) {
        const modal = document.getElementById('myModal');
        const modalImg = document.getElementById('img01');
        const exifInfo = document.getElementById('exif-info');
        
        // 移除所有图片的悬停状态
        document.querySelectorAll('.gallery img.hover-active').forEach(img => {
            img.classList.remove('hover-active');
        });
        
        document.body.classList.add('modal-open');
        modal.style.opacity = '1';
        
        if (window.isPageLoading) {
            console.log('页面正在加载，无法打开大图');
            return;
        }
        
        modal.style.display = 'flex';
        document.body.classList.add('no-scroll');
        
        // Find index of current image in the current list
        const images = this.getCurrentImages();
        this.currentModalIndex = images.findIndex(img => img.original === original);
        if (this.currentModalIndex === -1) {
            console.warn('Current image not found in list, navigation might be broken');
            this.currentModalIndex = 0;
        }
        
        // 创建加载动画
        const createLoadingSpinner = () => {
            return `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
            `;
        };
        
        // 检查当前模态窗口是否已经显示的是原图
        const isCurrentlyShowingOriginal = modalImg.src && modalImg.src.includes(original);
        
        // 显示预览图（如果当前不是原图）
        if (!isCurrentlyShowingOriginal) {
            console.log(`设置模态窗口预览图: ${preview}`);
            modalImg.src = preview;
            modalImg.style.filter = 'none';
            modalImg.style.transition = 'filter 0.3s ease';
        }
        
        // 保存原图URL，用于后续加载
        this.currentOriginalUrl = original;
        this.isModalOpen = true;
        
        // 判断是否显示加载原图按钮
        const loadOriginalBtn = document.getElementById('load-original-btn');
        // 如果当前显示的是原图，或者预览图URL与原图URL相同，不显示按钮
        if (isCurrentlyShowingOriginal || preview === original) {
            loadOriginalBtn.style.display = 'none';
        } else {
            loadOriginalBtn.style.display = 'flex';
        }
        
        // 获取EXIF信息
        this.getExifInfo(original).then(exifData => {
            // 检查模态窗口是否仍然打开
            if (!this.isModalOpen) {
                console.log('模态窗口已关闭，取消EXIF信息获取');
                return;
            }
            exifInfo.innerHTML = this.createExifInfo(exifData);
        }).catch(error => {
            console.error('获取EXIF信息失败:', error);
            if (this.isModalOpen) {
                exifInfo.innerHTML = '';
            }
        });
    }
    
    // 获取EXIF信息
    async getExifInfo(imageUrl) {
        // EXIF 功能已禁用
        return null;
        try {
            // 尝试从gallery-index.json中获取EXIF信息
            const images = this.getCurrentImages();
            const imageData = images.find(img => img.original === imageUrl);
            
            if (imageData && imageData.exif) {
                return imageData.exif;
            }
            
            // 如果没有预存的EXIF信息，尝试从服务器获取
            const response = await fetch(`/api/exif?url=${encodeURIComponent(imageUrl)}`);
            if (response.ok) {
                const exifData = await response.json();
                return exifData;
            }
            
            return null;
        } catch (error) {
            console.error('获取EXIF信息失败:', error);
            return null;
        }
    }

    // 下载原图
    downloadOriginalImage() {
        if (!this.currentOriginalUrl) return;

        const link = document.createElement('a');
        link.href = this.currentOriginalUrl;
        link.download = ''; // 使用默认文件名
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // 设置模态窗口事件
    setupModalEvents() {
        const modal = document.getElementById('myModal');
        const span = document.getElementsByClassName('close')[0];
        const modalContent = document.querySelector('.modal-content');
        const loadOriginalBtn = document.getElementById('load-original-btn');
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');

        span.onclick = () => this.closeModal();
        modalContent.onclick = (event) => event.stopPropagation();
        modal.onclick = () => this.closeModal();

        // 阻止左右切换按钮冒泡关闭模态框
        if (prevBtn) {
            prevBtn.onclick = (event) => {
                event.stopPropagation();
                this.showPrevImage();
            };
        }
        if (nextBtn) {
            nextBtn.onclick = (event) => {
                event.stopPropagation();
                this.showNextImage();
            };
        }

        // 下载原图按钮事件
        loadOriginalBtn.onclick = (event) => {
            event.stopPropagation();
            this.downloadOriginalImage();
        };

        // Keyboard navigation
        document.addEventListener('keydown', (event) => {
            if (!this.isModalOpen) return;
            
            if (event.key === 'Escape') {
                this.closeModal();
            } else if (event.key === 'ArrowLeft') {
                this.showPrevImage();
            } else if (event.key === 'ArrowRight') {
                this.showNextImage();
            }
        });

        // Touch navigation (Swipe)
        modal.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, {passive: true});

        modal.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe(touchEndX, touchEndY);
        }, {passive: true});
    }

    handleSwipe(endX, endY) {
        const diffX = endX - this.touchStartX;
        const diffY = endY - this.touchStartY;
        
        // Threshold for swipe (50px) and ensure horizontal movement dominates vertical
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                this.showPrevImage(); // Swipe Right -> Prev
            } else {
                this.showNextImage(); // Swipe Left -> Next
            }
        }
    }

    showPrevImage() {
        if (this.currentModalIndex > 0) {
            this.switchModalImage(this.currentModalIndex - 1);
        }
    }

    showNextImage() {
        const images = this.getCurrentImages();
        if (this.currentModalIndex < images.length - 1) {
            this.switchModalImage(this.currentModalIndex + 1);
        }
    }

    switchModalImage(index) {
        // Cancel current high-res loading if any
        if (this.currentHighResImage) {
            this.currentHighResImage.onload = null;
            this.currentHighResImage.onerror = null;
            this.currentHighResImage.src = '';
            this.currentHighResImage = null;
        }

        this.currentModalIndex = index;
        const images = this.getCurrentImages();
        const imageData = images[index];
        
        if (!imageData) return;

        // Reset modal state for new image
        const modalImg = document.getElementById('img01');
        const exifInfo = document.getElementById('exif-info');
        const loadOriginalBtn = document.getElementById('load-original-btn');
        const loader = document.getElementById('modal-loading');
        
        // Show loader, hide image
        if (loader) loader.style.display = 'flex';
        modalImg.style.opacity = '0';

        // Load new image
        modalImg.onload = () => {
             modalImg.style.opacity = '1';
             if (loader) loader.style.display = 'none';
             modalImg.onload = null;
        };
        modalImg.onerror = () => {
             modalImg.style.opacity = '1';
             if (loader) loader.style.display = 'none';
             modalImg.onerror = null;
        };
        
        // Show preview first
        modalImg.src = imageData.preview;
        modalImg.style.filter = 'none'; // Reset any filter
        this.currentOriginalUrl = imageData.original;
        
        // Reset download button state
        loadOriginalBtn.style.display = 'flex';
        loadOriginalBtn.innerHTML = '下载原图';
        loadOriginalBtn.classList.remove('loading');
        
        // Load EXIF for new image
        exifInfo.innerHTML = ''; // Clear old EXIF
        this.getExifInfo(imageData.original).then(exifData => {
            if (this.isModalOpen && this.currentModalIndex === index) {
                exifInfo.innerHTML = this.createExifInfo(exifData);
            }
        });
    }

    // 关闭模态窗口
    closeModal() {
        const modal = document.getElementById('myModal');
        // const loadOriginalBtn = document.getElementById('load-original-btn'); // 不需要操作按钮显示/隐藏，保持常显即可（或者根据需求）
        
        modal.style.opacity = '0';
        
        // 标记模态窗口已关闭
        this.isModalOpen = false;
        
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.classList.remove('no-scroll');
            modal.style.opacity = '1';
            
            setTimeout(() => {
                document.body.classList.remove('modal-open');
            }, 300);
        }, 300);
    }
}

// 导出为全局变量
window.ImageLoader = ImageLoader; 