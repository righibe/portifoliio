const tabs    = document.querySelectorAll('.tab');
const panes   = document.querySelectorAll('.pane');

function switchTab(id) {
    tabs.forEach(t  => t.classList.toggle('active',  t.dataset.tab === id));
    panes.forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});
