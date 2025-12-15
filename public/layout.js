document.addEventListener('DOMContentLoaded', () => {
    // 初始化主题
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }

    // Add loaded class to images after window load to enable hover effect
    window.addEventListener('load', () => {
        const images = document.querySelectorAll('.gallery img');
        images.forEach(img => {
            if (img.complete) {
                img.classList.add('loaded');
            } else {
                img.addEventListener('load', () => img.classList.add('loaded'));
            }
        });
    });
});
