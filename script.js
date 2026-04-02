const tabs    = document.querySelectorAll('.tab');
const panes   = document.querySelectorAll('.pane');
const langBtns= document.querySelectorAll('.lang-toggle button');
const translatables = document.querySelectorAll('[data-en][data-pt]');

function switchTab(id) {
    tabs.forEach(t  => t.classList.toggle('active',  t.dataset.tab === id));
    panes.forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchLang(lang) {
    langBtns.forEach(btn => btn.classList.toggle('active', btn.id === 'btn-' + lang));
    translatables.forEach(el => {
        if(lang === 'pt' && el.dataset.pt) {
            el.innerHTML = el.dataset.pt;
        } else if(lang === 'en' && el.dataset.en) {
            el.innerHTML = el.dataset.en;
        }
    });
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.id.replace('btn-', '');
        switchLang(lang);
    });
});
