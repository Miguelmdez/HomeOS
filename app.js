(() => {
    'ng strict';

    const STORE = 'homeos_state_v1';
    const $ = (q, root = document) => root.querySelector(q);
    const app = $('#app');
    const editSections = new Set();
    let activeTab = 'today';
    let modalState = null;
    let selectedPlannerDay = new Date().getDay();

    const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const todayKey = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    const defaults = {
        lastOpenDate: todayKey(),
        dailyBaseTasks: [
            { id: 'daily-base-1', name: 'Fregar platos de comida y cena', checked: false },
            { id: 'daily-base-2', name: 'Recoger escritorio', checked: false }
        ],
        dailyTasks: [
            { id: 'daily-1', name: 'Recoger cocina' }, { id: 'daily-2', name: 'Revisar correo' }, { id: 'daily-3', name: 'Ordenar entradas' }
        ],
        todayTasks: [],
        todayChecked: {},
        weeklyTemplates: {
            0: [{ id: 'week-0-1', name: 'Preparar tareas para la semana' }],
            1: [{ id: 'week-1-1', name: 'Poner lavadora ropa clara' }, { id: 'week-1-2', name: 'Secadora y doblar ropa' }],
            2: [{ id: 'week-2-1', name: 'Poner lavadora ropa oscura' }, { id: 'week-2-2', name: 'Secadora y doblar ropa' }],
            3: [],
            4: [],
            5: [],
            6: [{ id: 'week-6-1', name: 'Hacer compra semanal' }]
        },
        habits: [
            { id: 'habit-1', name: 'Beber agua', checked: false, category: 'Bienestar' }, { id: 'habit-2', name: 'Caminar 20 minutos', checked: false, category: 'Salud' }
        ],
        weeklyTasks: [
            { id: 'weekly-1', name: 'Vaciar papelera', day: 'Lunes', checked: false }, { id: 'weekly-2', name: 'Cambiar sábanas', day: 'Sábado', checked: false }, { id: 'weekly-3', name: 'Hacer compra semanal', day: 'Domingo', checked: false }
        ],
        recipes: [{ id: 'recipe-1', name: 'Pasta integral', category: 'Rápida' }],
        menu: [{ id: 'menu-1', name: 'Pasta integral', day: 'Lunes' }],
        lukeDaily: [{ id: 'luke-d1', name: 'Comida', checked: false }, { id: 'luke-d2', name: 'Agua limpia', checked: false }],
        lukePeriodic: [{ id: 'luke-p1', name: 'Cepillar', frequency: 3, lastDone: todayKey() }, { id: 'luke-p2', name: 'Desparasitación', frequency: 30, lastDone: todayKey() }],
        quickRestock: [{ id: 'restock-1', name: 'Leche', category: 'Alimentación' }],
        categories: [{ id: 'cat-1', name: 'Alimentación' }, { id: 'cat-2', name: 'Limpieza' }, { id: 'cat-3', name: 'Higiene' }],
        frequent: [{ id: 'freq-1', name: 'Pan', category: 'Alimentación' }, { id: 'freq-2', name: 'Leche', category: 'Alimentación' }],
        pantry: [{ id: 'pantry-1', name: 'Arroz', category: 'Alimentación' }],
        maintenance: [{ id: 'maint-1', name: 'Limpiar filtros', frequency: 30, lastDone: todayKey() }],
        budgets: [{ id: 'budget-1', name: 'Compra mensual', amount: 250 }],
        shopping: []
    };

    let state = load();

    function load() {
        let result;
        try { result = JSON.parse(localStorage.getItem(STORE)); } catch (_) { }
        const loaded = result;
        result = { ...defaults, ...(result || {}) };
        if (loaded && !Array.isArray(loaded.dailyBaseTasks) && Array.isArray(loaded.dailyTasks)) {
            result.dailyBaseTasks = loaded.dailyTasks.map(i => ({ id: i.id, name: i.name, checked: false }));
        }
        Object.keys(defaults).forEach(key => {
            if (defaults[key] instanceof Array && !Array.isArray(result[key])) result[key] = [];
        });
        normalizeLegacyChecks(result);
        checkDayReset(result);
        save(result);
        return result;
    }

    function normalizeLegacyChecks(s) {
        s.dailyChecked = s.dailyChecked || {};
        s.todayChecked = s.todayChecked || {};

        if (!Array.isArray(s.dailyBaseTasks)) {
            if (Array.isArray(s.dailyTasks) && s.dailyTasks.length) s.dailyBaseTasks = s.dailyTasks.map(i => ({ id: i.id, name: i.name, checked: false }));
            else s.dailyBaseTasks = defaults.dailyBaseTasks.map(i => ({ ...i }));
        }

        if (!s.weeklyTemplates || typeof s.weeklyTemplates !== 'object') s.weeklyTemplates = {};
        for (let day = 0; day < 7; day++) {
            if (!Array.isArray(s.weeklyTemplates[day])) s.weeklyTemplates[day] = [];
        }

        if (Array.isArray(s.weeklyTasks) && s.weeklyTasks.length) {
            const dayToIndex = { Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6 };
            s.weeklyTasks.forEach(task => {
                const day = dayToIndex[task.day];
                if (day !== undefined && !s.weeklyTemplates[day].some(i => i.id === task.id)) {
                    s.weeklyTemplates[day].push({ id: task.id, name: task.name });
                }
            });
        }

        generateTodayTasks(s);
    }

    function checkDayReset(s) {
        const today = todayKey();
        if (s.lastOpenDate !== today) {
            s.dailyChecked = {};
            s.todayChecked = {};
            s.habits?.forEach(i => i.checked = false);
            s.weeklyTasks?.forEach(i => i.checked = false);
            s.lukeDaily?.forEach(i => i.checked = false);
            s.lastOpenDate = today;
        }
        generateTodayTasks(s);
    }

    function generateTodayTasks(s) {
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const currentDay = new Date().getDay();
        const routineItems = s.weeklyTemplates[currentDay] || [];
        s.todayTasks = [
            ...(s.dailyBaseTasks || []).map(item => ({
                id: `fixed:${item.id}`,
                sourceId: item.id,
                name: item.name,
                kind: 'fixed',
                badge: 'Diaria',
                checked: !!s.todayChecked[`fixed:${item.id}`]
            })),
            ...routineItems.map(item => ({
                id: `weekly:${item.id}`,
                sourceId: item.id,
                name: item.name,
                kind: 'weekly',
                badge: dayNames[currentDay],
                checked: !!s.todayChecked[`weekly:${item.id}`]
            }))
        ];
    }

    function save(next = state) {
        localStorage.setItem(STORE, JSON.stringify(next));
    }

    function toast(message) {
        const el = $('#toast');
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => el.classList.remove('show'), 1800);
    }

    function dateLabel() {
        return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'short' }).format(new Date());
    }

    function setHeader(tab) {
        const names = { today: 'Hoy', kitchen: 'Cocina', luke: 'Luke', shopping: 'Compra', more: 'Más' };
        $('#headerTitle').textContent = names[tab];
        $('#headerDate').textContent = dateLabel();
    }

    function iconEdit(section) {
        return `<button class="edit-toggle" data-edit-section="${section}" aria-label="Editar sección" title="Editar">✎</button>`;
    }

    function sectionHead(title, section, extra = '') {
        return `<div class="section-head"><h2>${esc(title)}</h2><div>${extra}${iconEdit(section)}</div></div>`;
    }

    function editControls(collection, item) {
        return `<div class="item-actions">
      <button class="small-button" data-add-item="${collection}" data-id="${item.id}" aria-label="Editar">✎</button>
      <button class="small-button danger" data-delete-item="${collection}" data-id="${item.id}" aria-label="Eliminar">×</button>
      <button class="small-button" data-move-item="${collection}" data-id="${item.id}" data-dir="-1" aria-label="Subir">↑</button>
      <button class="small-button" data-move-item="${collection}" data-id="${item.id}" data-dir="1" aria-label="Bajar">↓</button>
    </div>`;
    }

    function addButton(collection, label = 'Añadir') {
        return `<button class="button secondary full" data-add-item="${collection}">＋ ${esc(label)}</button>`;
    }

    function render() {
        checkDayReset(state); save();
        setHeader(activeTab);
        if (activeTab === 'today') renderToday();
        if (activeTab === 'kitchen') renderKitchen();
        if (activeTab === 'luke') renderLuke();
        if (activeTab === 'shopping') renderShopping();
        if (activeTab === 'more') renderMore();
    }

    function renderToday() {
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const todayName = dayNames[new Date().getDay()];
        const todayDone = state.todayTasks.filter(i => i.checked).length;
        const habitDone = state.habits.filter(i => i.checked).length;
        const dayLabels = [
            { index: 1, label: 'L' }, { index: 2, label: 'M' }, { index: 3, label: 'X' },
            { index: 4, label: 'J' }, { index: 5, label: 'V' }, { index: 6, label: 'S' }, { index: 0, label: 'D' }
        ];
        const plannerItems = state.weeklyTemplates[selectedPlannerDay] || [];

        app.innerHTML = `
      <section class="section"><div class="card grid-two">
        <div class="stat"><span class="tag">Tareas de hoy</span><strong>${todayDone}/${state.todayTasks.length}</strong><div class="progress"><i style="width:${percent(todayDone, state.todayTasks.length)}%"></i></div></div>
        <div class="stat"><span class="tag">Hábitos</span><strong>${habitDone}/${state.habits.length}</strong><div class="progress"><i style="width:${percent(habitDone, state.habits.length)}%"></i></div></div>
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Tareas de hoy', 'todayTasks', '')}
        ${state.todayTasks.length ? state.todayTasks.map(i => `
          <div class="card-row">
            <button class="check-row ${i.checked ? 'done' : ''}" data-check="todayTasks" data-id="${esc(i.id)}">
              <span class="check-box"></span>
              <span class="item-name">${esc(i.name)}</span>
              <span class="badge ${i.kind === 'fixed' ? 'fixed' : 'routine'}">${esc(i.badge)}</span>
            </button>
          </div>`).join('') : '<div class="empty">Sin tareas para hoy</div>'}
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Tareas diarias fijas', 'dailyBaseTasks', '')}
        ${state.dailyBaseTasks.length ? state.dailyBaseTasks.map(i => `
          <div class="card-row">
            <span class="item-name">${esc(i.name)}</span>
            ${editSections.has('dailyBaseTasks') ? editControls('dailyBaseTasks', i) : '<span class="badge fixed">Diaria</span>'}
          </div>`).join('') : '<div class="empty">Sin tareas fijas</div>'}
        ${editSections.has('dailyBaseTasks') ? `<div class="edit-panel">${addButton('dailyBaseTasks', 'Nueva tarea fija')}</div>` : ''}
      </div></section>

      <section class="section"><div class="card week-planner">
        ${sectionHead('Planificador semanal', 'weeklyTemplates', '')}
        <div class="day-tabs" aria-label="Días de la semana">
          ${dayLabels.map(day => `<button class="day-tab ${selectedPlannerDay === day.index ? 'active' : ''}" data-planner-day="${day.index}" aria-label="${esc(dayNames[day.index])}">${day.label}</button>`).join('')}
        </div>
        <div>
          <div class="category-title">${esc(dayNames[selectedPlannerDay])}</div>
          ${plannerItems.length ? plannerItems.map(i => `
            <div class="card-row">
              <span class="item-name">${esc(i.name)}</span>
              ${editSections.has('weeklyTemplates') ? `
                <div class="item-actions">
                  <button class="small-button" data-template-add="${selectedPlannerDay}" data-template-id="${esc(i.id)}" aria-label="Editar">✎</button>
                  <button class="small-button danger" data-template-delete="${selectedPlannerDay}" data-template-id="${esc(i.id)}" aria-label="Eliminar">×</button>
                  <button class="small-button" data-template-move="${selectedPlannerDay}" data-template-id="${esc(i.id)}" data-dir="-1" aria-label="Subir">↑</button>
                  <button class="small-button" data-template-move="${selectedPlannerDay}" data-template-id="${esc(i.id)}" data-dir="1" aria-label="Bajar">↓</button>
                </div>` : ''}
            </div>`).join('') : '<div class="empty">Sin rutinas configuradas</div>'}
          ${editSections.has('weeklyTemplates') ? `<div class="edit-panel"><button class="button secondary full" data-template-add="${selectedPlannerDay}">＋ Nueva rutina</button></div>` : ''}
        </div>
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Hábitos', 'habits', '')}
        ${state.habits.length ? state.habits.map(i => cardCheck(i, 'habits', 'habits')).join('') : '<div class="empty">Sin hábitos</div>'}
        ${editSections.has('habits') ? `<div class="edit-panel">${addButton('habits', 'Nuevo hábito')}</div>` : ''}
      </div></section>`;
    }

    function percent(done, total) { return total ? Math.round(done / total * 100) : 0; }

    function cardCheck(item, kind, collection) {
        let checked = kind === 'dailyChecked' ? !!state.dailyChecked[item.id] : !!item.checked;
        const editing = editSections.has(collection);
        return `<div class="card-row"><button class="check-row ${checked ? 'done' : ''}" data-check="${collection}" data-id="${item.id}" ${kind === 'dailyChecked' ? `data-daily="1"` : ''}><span class="check-box"></span><span class="item-name">${esc(item.name)}</span>${item.category ? `<span class="badge">${esc(item.category)}</span>` : ''}</button>${editing ? editControls(collection, item) : ''}</div>`;
    }

    function renderKitchen() {
        app.innerHTML = `
      <section class="section"><div class="card">
        ${sectionHead('Recetas', 'recipes', '')}
        ${state.recipes.length ? state.recipes.map(i => `<div class="card-row"><span class="item-name">${esc(i.name)}</span><span class="meta">${i.category ? esc(i.category) : ''}</span>${editSections.has('recipes') ? editControls('recipes', i) : ''}</div>`).join('') : '<div class="empty">Sin recetas</div>'}
        ${editSections.has('recipes') ? `<div class="edit-panel">${addButton('recipes', 'Nueva receta')}</div>` : ''}
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Menú semanal', 'menu', '')}
        ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => {
            const items = state.menu.filter(i => i.day === day);
            return `<div class="category-title">${day}</div>${items.length ? items.map(i => `<div class="card-row menu-plato"><span class="item-name">${esc(i.name)}</span>${editSections.has('menu') ? editControls('menu', i) : ''}</div>`).join('') : '<div class="meta">Sin platos</div>'}`;
        }).join('')}
        ${editSections.has('menu') ? `<div class="edit-panel">${addButton('menu', 'Añadir plato')}</div>` : ''}
      </div></section>`;
    }

    function daysSince(date) {
        if (!date) return Infinity;
        const past = new Date(date + 'T12:00:00');
        return Math.floor((new Date(todayKey() + 'T12:00:00') - past) / 86400000);
    }

    function renderLuke() {
        app.innerHTML = `
      <section class="section"><div class="card">
        ${sectionHead('Cuidados diarios', 'lukeDaily', '')}
        ${state.lukeDaily.length ? state.lukeDaily.map(i => cardCheck(i, 'lukeDaily', 'lukeDaily')).join('') : '<div class="empty">Sin cuidados diarios</div>'}
        ${editSections.has('lukeDaily') ? `<div class="edit-panel">${addButton('lukeDaily', 'Nuevo cuidado diario')}</div>` : ''}
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Cuidados periódicos', 'lukePeriodic', '')}
        ${state.lukePeriodic.length ? state.lukePeriodic.map(i => {
            const elapsed = daysSince(i.lastDone); const freq = Number(i.frequency) || 0;
            const due = freq > 0 && elapsed >= freq;
            const editing = editSections.has('lukePeriodic');
            return `<div class="card-row"><button class="check-row ${due ? '' : 'done'}" data-check="lukePeriodic" data-id="${i.id}"><span class="check-box"></span><span class="item-name">${esc(i.name)}</span><span class="badge ${due ? 'due' : 'today'}">${due ? 'Vencido' : `cada ${freq} d`}</span></button>${editing ? editControls('lukePeriodic', i) : ''}</div>`;
        }).join('') : '<div class="empty">Sin cuidados periódicos</div>'}
        ${editSections.has('lukePeriodic') ? `<div class="edit-panel">${addButton('lukePeriodic', 'Nuevo cuidado periódico')}</div>` : ''}
      </div></section>`;
    }

    function renderShopping() {
        const categories = state.categories.length ? state.categories : [{ name: 'Sin categoría', id: 'none' }];
        app.innerHTML = `
      <section class="section"><div class="card">
        ${sectionHead('Reposición rápida', 'quickRestock', '')}
        ${state.quickRestock.length ? (editSections.has('quickRestock') ? state.quickRestock.map(i => `<div class="card-row"><span class="item-name">${esc(i.name)}</span>${editControls('quickRestock', i)}</div>`).join('') : `<div class="grid-two">${state.quickRestock.map(i => `<button class="button primary" data-restock="${i.id}">${esc(i.name)}</button>`).join('')}</div>`) : '<div class="empty">Sin botones rápidos</div>'}
        ${editSections.has('quickRestock') ? `<div class="edit-panel">${addButton('quickRestock', 'Nuevo botón')}</div>` : ''}
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Lista de compra', 'shopping', '')}
        ${categories.map(cat => {
            const items = state.shopping.filter(i => (i.category || '') === cat.name);
            if (!items.length && editSections.has('shopping')) return '';
            return items.length ? `<div class="category-title">${esc(cat.name)}</div>${items.map(i => cardCheck(i, 'shopping', 'shopping')).join('')}` : '';
        }).join('') || '<div class="empty">Lista vacía</div>'
            }
        ${editSections.has('shopping') ? `<div class="edit-panel">${addButton('shopping', 'Añadir a la compra')}</div>` : ''}
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Básicos frecuentes', 'frequent', '')}
        ${state.frequent.length ? state.frequent.map(i => `<div class="card-row"><button class="button secondary" data-restock-frequent="${i.id}">${esc(i.name)}</button>${editSections.has('frequent') ? editControls('frequent', i) : ''}</div>`).join('') : '<div class="empty">Sin básicos</div>'}
        ${editSections.has('frequent') ? `<div class="edit-panel">${addButton('frequent', 'Nuevo básico')}</div>` : ''}
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Despensa', 'pantry', '')}
        ${state.pantry.length ? state.pantry.map(i => `<div class="card-row"><span class="item-name">${esc(i.name)}</span><span class="badge">${esc(i.category || 'Despensa')}</span>${editSections.has('pantry') ? editControls('pantry', i) : ''}</div>`).join('') : '<div class="empty">Despensa vacía</div>'}
        ${editSections.has('pantry') ? `<div class="edit-panel">${addButton('pantry', 'Añadir despensa')}</div>` : ''}
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Categorías', 'categories', '')}
        ${state.categories.length ? state.categories.map(i => `<div class="card-row"><span class="item-name">${esc(i.name)}</span>${editSections.has('categories') ? editControls('categories', i) : ''}</div>`).join('') : '<div class="empty">Sin categorías</div>'}
        ${editSections.has('categories') ? `<div class="edit-panel">${addButton('categories', 'Nueva categoría')}</div>` : ''}
      </div></section>`;
    }

    function renderMore() {
        app.innerHTML = `
      <section class="section"><div class="card">
        ${sectionHead('Mantenimiento profundo', 'maintenance', '')}
        ${state.maintenance.length ? state.maintenance.map(i => {
            const elapsed = daysSince(i.lastDone); const freq = Number(i.frequency) || 0; const due = freq > 0 && elapsed >= freq;
            return `<div class="card-row"><button class="check-row ${due ? '' : 'done'}" data-check="maintenance" data-id="${i.id}"><span class="check-box"></span><span class="item-name">${esc(i.name)}</span><span class="badge ${due ? 'due' : 'today'}">${freq ? `${freq} d` : ''}</span></button>${editSections.has('maintenance') ? editControls('maintenance', i) : ''}</div>`;
        }).join('') : '<div class="empty">Sin tareas de mantenimiento</div>'}
        ${editSections.has('maintenance') ? `<div class="edit-panel">${addButton('maintenance', 'Nueva tarea')}</div>` : ''}
      </div></section>

      <section class="section"><div class="card">
        ${sectionHead('Presupuestos', 'budgets', '')}
        ${state.budgets.length ? state.budgets.map(i => `<div class="card-row"><span class="item-name">${esc(i.name)}</span><span class="badge">${esc(i.amount || '0')} €</span>${editSections.has('budgets') ? editControls('budgets', i) : ''}</div>`).join('') : '<div class="empty">Sin presupuestos</div>'}
        ${editSections.has('budgets') ? `<div class="edit-panel">${addButton('budgets', 'Nuevo presupuesto')}</div>` : ''}
      </div></section>

      <section class="section"><div class="card"><div class="section-head"><h2>Datos</h2></div>
        <button class="button secondary full" id="exportState">Exportar copia JSON</button>
        <p class="swipe-note"></p>
        <button class="button secondary full" id="resetState" style="margin-top:8px;color:var(--danger)">Restablecer todos los datos</button>
      </div></section>`;
    }

    function openModal(collection, item = null, day = null) {
        modalState = { collection, item, day };
        $('#modalTitle').textContent = item ? 'Editar elemento' : 'Añadir elemento';
        const fields = modalFields(collection, item || {});
        $('#modalFields').innerHTML = fields;
        $('#modalBackdrop').hidden = false;
        setTimeout(() => $('#modalFields input, #modalFields select')?.focus(), 20);
    }

    function modalFields(collection, item) {
        const name = `<div class="field"><label for="fieldName">Nombre</label><input id="fieldName" name="name" required maxlength="80" value="${esc(item.name || '')}"></div>`;
        let extra = '';
        if (['dailyBaseTasks', 'dailyTasks', 'habits', 'recipes', 'lukeDaily', 'quickRestock', 'frequent', 'pantry', 'categories', 'shopping', 'weeklyTasks', 'lukePeriodic', 'maintenance', 'budgets', 'menu'].includes(collection)) {
            if (['habits', 'lukeDaily', 'quickRestock', 'frequent', 'pantry', 'categories', 'shopping', 'dailyBaseTasks', 'dailyTasks', 'recipes', 'budgets', 'maintenance', 'weeklyTasks', 'lukePeriodic', 'menu'].includes(collection)) {
                if (['lukePeriodic', 'maintenance'].includes(collection)) extra += fieldFrequency(item);
                if (collection === 'habits' || collection === 'recipes' || collection === 'pantry' || collection === 'shopping' || collection === 'quickRestock' || collection === 'frequent') extra += fieldCategory(item);
                if (collection === 'budgets') extra += `<div class="field"><label for="fieldAmount">Importe (€)</label><input id="fieldAmount" name="amount" type="number" min="0" step="0.01" value="${esc(item.amount || '')}"></div>`;
                if (collection === 'weeklyTasks' || collection === 'menu') extra += fieldDay(item);
            }
        }
        return name + extra;
    }

    function fieldFrequency(item) { return `<div class="field"><label for="fieldFrequency">Frecuencia (días)</label><input id="fieldFrequency" name="frequency" type="number" min="1" max="365" value="${esc(item.frequency || 30)}"></div>`; }
    function fieldCategory(item) {
        const options = state.categories.map(c => `<option value="${esc(c.name)}" ${item.category === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
        if (['shopping', 'pantry'].includes(modalState?.collection)) return `<div class="field"><label for="fieldCategory">Categoría</label><select id="fieldCategory" name="category"><option value="">Sin categoría</option>${options}</select></div>`;
        return `<div class="field"><label for="fieldCategory">Categoría</label><input id="fieldCategory" name="category" value="${esc(item.category || '')}"></div>`;
    }
    function fieldDay(item) {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        return `<div class="field"><label for="fieldDay">Día</label><select id="fieldDay" name="day">${days.map(d => `<option ${item.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>`;
    }

    function closeModal() { $('#modalBackdrop').hidden = true; modalState = null; }

    function deleteItem(collection, id) {
        if (!confirm('¿Eliminar este elemento?')) return;
        state[collection] = state[collection].filter(i => i.id !== id);
        if (collection === 'dailyBaseTasks') generateTodayTasks(state);
        save(); render(); toast('Elemento eliminado');
    }

    function moveItem(collection, id, dir) {
        const arr = state[collection]; const idx = arr.findIndex(i => i.id === id); const next = idx + dir;
        if (next < 0 || next >= arr.length) return;
        [arr[idx], arr[next]] = [arr[next], arr[idx]];
        if (collection === 'dailyBaseTasks') generateTodayTasks(state);
        save(); render();
    }

    app.addEventListener('click', event => {
        const plannerDay = event.target.closest('[data-planner-day]');
        if (plannerDay) {
            selectedPlannerDay = Number(plannerDay.dataset.plannerDay);
            render();
            return;
        }

        const templateAdd = event.target.closest('[data-template-add]');
        if (templateAdd) {
            const day = Number(templateAdd.dataset.templateAdd);
            const item = templateAdd.dataset.templateId
                ? state.weeklyTemplates[day].find(i => i.id === templateAdd.dataset.templateId)
                : null;
            openModal('weeklyTemplates', item, day);
            return;
        }

        const templateDelete = event.target.closest('[data-template-delete]');
        if (templateDelete) {
            if (!confirm('¿Eliminar esta rutina?')) return;
            const day = Number(templateDelete.dataset.templateDelete);
            state.weeklyTemplates[day] = state.weeklyTemplates[day].filter(i => i.id !== templateDelete.dataset.templateId);
            generateTodayTasks(state);
            save();
            render();
            toast('Rutina eliminada');
            return;
        }

        const templateMove = event.target.closest('[data-template-move]');
        if (templateMove) {
            const day = Number(templateMove.dataset.templateMove);
            const arr = state.weeklyTemplates[day];
            const idx = arr.findIndex(i => i.id === templateMove.dataset.templateId);
            const next = idx + Number(templateMove.dataset.dir);
            if (idx >= 0 && next >= 0 && next < arr.length) {
                [arr[idx], arr[next]] = [arr[next], arr[idx]];
                generateTodayTasks(state);
                save();
                render();
            }
            return;
        }

        const edit = event.target.closest('[data-edit-section]');
        if (edit) { const s = edit.dataset.editSection; editSections.has(s) ? editSections.delete(s) : editSections.add(s); render(); return; }

        const add = event.target.closest('[data-add-item]');
        if (add) { openModal(add.dataset.addItem, add.dataset.id ? state[add.dataset.addItem].find(i => i.id === add.dataset.id) : null); return; }

        const del = event.target.closest('[data-delete-item]');
        if (del) { deleteItem(del.dataset.deleteItem, del.dataset.id); return; }

        const move = event.target.closest('[data-move-item]');
        if (move) { moveItem(move.dataset.moveItem, move.dataset.id, Number(move.dataset.dir)); return; }

        const check = event.target.closest('[data-check]');
        if (check) {
            const collection = check.dataset.check, id = check.dataset.id;
            if (collection === 'todayTasks') {
                const item = state.todayTasks.find(x => x.id === id);
                if (item) {
                    item.checked = !item.checked;
                    state.todayChecked[id] = item.checked;
                    toast(item.checked ? 'Tarea completada' : 'Tarea marcada pendiente');
                }
            }
            else if (collection === 'habits') { const i = state.habits.find(x => x.id === id); i.checked = !i.checked; toast(i.checked ? 'Hábito completado' : 'Hábito pendiente'); }
            else if (collection === 'shopping') { const i = state.shopping.find(x => x.id === id); i.checked = !i.checked; toast(i.checked ? 'Añadido a la compra' : 'Compra pendiente'); }
            else if (collection === 'lukeDaily') { const i = state.lukeDaily.find(x => x.id === id); i.checked = !i.checked; toast(i.checked ? 'Cuidado completado' : 'Cuidado pendiente'); }
            else if (collection === 'lukePeriodic') { const i = state.lukePeriodic.find(x => x.id === id); i.lastDone = todayKey(); toast('Cuidado registrado'); }
            else if (collection === 'maintenance') { const i = state.maintenance.find(x => x.id === id); i.lastDone = todayKey(); toast('Mantenimiento registrado'); }
            save(); render(); return;
        }

        const restock = event.target.closest('[data-restock]');
        if (restock) { const i = state.quickRestock.find(x => x.id === restock.dataset.restock); if (i) addToShopping(i.name, i.category); return; }
        const frequent = event.target.closest('[data-restock-frequent]');
        if (frequent) { const i = state.frequent.find(x => x.id === frequent.dataset.restockFrequent); if (i) addToShopping(i.name, i.category); return; }

        if (event.target.id === 'resetState') {
            if (confirm('Esta acción eliminará todos los datos locales. ¿Continuar?')) {
                state = JSON.parse(JSON.stringify(defaults));
                state.lastOpenDate = todayKey();
                normalizeLegacyChecks(state);
                save();
                render();
                toast('Datos restablecidos');
            }
        }
        if (event.target.id === 'exportState') {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'homeos-backup.json'; a.click(); URL.revokeObjectURL(url); toast('Copia exportada');
        }
    });

    function addToShopping(name, category = '') {
        state.shopping.push({ id: uid(), name, category, checked: false }); save(); toast(`${name} añadido a la compra`); render();
    }

    document.querySelector('.bottom-nav').addEventListener('click', event => {
        const item = event.target.closest('[data-tab]'); if (!item) return;
        activeTab = item.dataset.tab;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i === item));
        window.scrollTo({ top: 0, behavior: 'smooth' }); render();
    });

    $('#quickAddButton').addEventListener('click', () => {
        if (activeTab === 'today') openModal('dailyBaseTasks');
        else {
            const map = { kitchen: 'recipes', luke: 'lukeDaily', shopping: 'shopping', more: 'maintenance' };
            openModal(map[activeTab]);
        }
    });

    $('#modalClose').addEventListener('click', closeModal);
    $('#modalCancel').addEventListener('click', closeModal);
    $('#modalBackdrop').addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });

    $('#itemForm').addEventListener('submit', event => {
        event.preventDefault(); if (!modalState) return;
        const form = new FormData(event.currentTarget); const collection = modalState.collection; const existing = modalState.item;
        const item = { ...(existing || {}), id: existing?.id || uid(), name: String(form.get('name')).trim() };
        ['frequency', 'category', 'day', 'amount'].forEach(k => { if (form.has(k)) item[k] = k === 'frequency' || k === 'amount' ? Number(form.get(k)) : String(form.get(k)); });
        if (!item.name) return;
        if (collection === 'weeklyTemplates') {
            const day = modalState.day;
            if (!Array.isArray(state.weeklyTemplates[day])) state.weeklyTemplates[day] = [];
            if (existing) {
                const index = state.weeklyTemplates[day].findIndex(i => i.id === existing.id);
                if (index >= 0) state.weeklyTemplates[day][index] = item;
            } else {
                state.weeklyTemplates[day].push(item);
            }
            generateTodayTasks(state);
            save();
            closeModal();
            render();
            toast(existing ? 'Rutina actualizada' : 'Rutina añadida');
            return;
        }
        if (collection === 'lukePeriodic' && !item.lastDone) item.lastDone = todayKey();
        if (collection === 'maintenance' && !item.lastDone) item.lastDone = todayKey();
        if (collection === 'shopping') item.checked = existing?.checked || false;
        if (collection === 'habits' || collection === 'lukeDaily') item.checked = existing?.checked || false;
        if (collection === 'dailyTasks') item.checked = false;
        if (existing) state[collection][state[collection].findIndex(i => i.id === existing.id)] = item;
        else state[collection].push(item);
        if (collection === 'dailyBaseTasks') generateTodayTasks(state);
        save(); closeModal(); render(); toast(existing ? 'Cambios guardados' : 'Elemento añadido');
    });

    setInterval(() => { const before = state.lastOpenDate; checkDayReset(state); if (before !== state.lastOpenDate) { save(); render(); toast('Se ha iniciado un nuevo día'); } }, 60000);

    window.addEventListener('storage', e => {
        if (e.key === STORE) {
            try {
                state = { ...defaults, ...(JSON.parse(e.newValue) || {}) };
                normalizeLegacyChecks(state);
                checkDayReset(state);
                save();
                render();
            } catch (_) { }
        }
    });

    if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));

    render();
})();
