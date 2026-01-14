(async () => {
    const server = {
        scheme: 'http',
        host: 'localhost',
        port: '9999',
        key: ''
    };

    function GetApiUrl() {
        let { scheme, host, port } = server;
        return `${scheme}://${host}:${port}/graphql`;
    };

    const css = document.createElement('style');
    css.innerHTML = `
        .awesomplete li {
          display: flex;
          align-items: center;
          background: #394b59;
        }

        .awesomplete li img {
          max-width: 100px;
          max-height: 50px;
          margin-right: 5px;
        }

        .awesomplete li span {
          flex: 1;
          color: #fff; /* Adjust text color for better visibility in dark mode */
        }

        #scene-autocomplete.form-control.awesomplete {
          width: 100%;
          background: #394b59; /* Default fill color for the search box */
          color: white; /* Text color inside the search box */
        }

        .autocomplete-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
    `;

    document.head.appendChild(css);

    function WaitElement(selector, callback) {

        const observer = new MutationObserver((mutations, obs) => {

            const element = document.querySelector(selector);

            if (element) {

                obs.disconnect();
                callback(element);
            };
        });

        observer.observe(document, {

            childList: true,
            subtree: true
        });
    };

    let relatedTabContent = null;

    async function MakeMenu() {

        const navBar = document.querySelector('.nav.nav-tabs');
        let menuButton = document.createElement('a');
        let currentPage = window.location.href.split('/');
        currentPage.pop();
        const falsePage = currentPage.join('/') + '/related';
        menuButton.className = 'nav-item nav-link';
        menuButton.id = 'performer-tabs-tab-related';
        menuButton.role = 'tab';
        menuButton.innerText = 'Related';
        menuButton.ariaSelected = false;
        menuButton.style.cursor = 'pointer';
        navBar.appendChild(menuButton);

        relatedTabContent = document.createElement('div');
        relatedTabContent.id = 'performer-tabs-tabpane-related';
        relatedTabContent.role = 'tabpanel'
        relatedTabContent.className = 'fade tab-pane';

        menuButton.onclick = RelatedSelected;
        let allMenu = document.querySelectorAll('.nav-item.nav-link');
        allMenu.forEach((tab) => {
            if (tab.id === 'performer-tabs-tab-related') return;
            tab.addEventListener('click', () => { document.querySelector('#performer-tabs-tab-related').classList.remove('active'); });
        });
    };

    function RelatedSelected() {
        let currentActive = document.querySelector('.active')
        if (currentActive.id != this.id) currentActive.classList.remove('active');
        document.querySelector('.fade.tab-pane.active.show').classList.remove('active', 'show');
        this.ariaSelected = true;
        this.classList.add('active');
        let tabContent = document.querySelector('.tab-content');
        relatedTabContent.classList.add('active', 'show');
        tabContent.appendChild(relatedTabContent);
    };

    async function AutoComplete(container) {

        if (document.querySelector('#performer-tabs-tab-related')) return;

        await MakeMenu();

        const group = document.createElement('div');
        group.className = 'form-group row autocomplete-container';

        const label = document.createElement('h3');
        label.setAttribute('for', 'scene-autocomplete');
        label.style.textAlign = 'center';
        label.innerText = 'Add related performers';

        const input = document.createElement('input');
        input.id = 'scene-autocomplete';
        input.className = 'form-control awesomplete';
        input.setAttribute('data-list', '');

        const button = document.createElement('button');
        button.className = 'btn btn-primary';
        button.innerText = 'Add Performer';

        group.appendChild(label);
        group.appendChild(input);
        group.appendChild(button);

        relatedTabContent.append(group);

        const awesomplete = new Awesomplete(input, {
            minChars: 1,
            maxItems: 10,
            item: (text, input) => {
                console.log(text)
                console.log(input)
                const li = document.createElement('li');
                const img = document.createElement('img');
                const [name, image_path] = text.split('|');
                img.src = image_path.trim();
                const div = document.createElement('div');
                div.textContent = name.trim();
                li.appendChild(img);
                li.appendChild(div);
                return li;
            },
            replace: (text) => {
                const [name] = text.split('|');
                input.value = name.trim();
            }
        });
        input.addEventListener('input', () => FilterPerformer(input, awesomplete));
        button.addEventListener('click', () => LinkPerformer(input, awesomplete));

        await AllPerformers();
        await ShowRelated();
    };

    function UpdateAutoComplete(input, awesomplete, performers) {
        const list = performers.map(performer => `${performer.name} | ${performer.image_path} | `);
        awesomplete.list = list;
    };

    async function AllPerformers() {
        const query = `query { allPerformers { id name image_path} }`;

        try {

            let response = await fetch(GetApiUrl(), {

                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${server.key}`
                },
                body: JSON.stringify({ query })
            });

            var data = await response.json();
            var performers = data.data.allPerformers;
            sessionStorage.setItem('AllPerformers', JSON.stringify(performers));

        } catch (error) {
            console.error('Error fetching performers:', error);
        };
    };

    async function FilterPerformer(input, awesomplete) {
        let performers = JSON.parse(sessionStorage.getItem('AllPerformers'));
        input.performerMap = performers.reduce((map, performer) => {
            map[performer.name] = { id: performer.id, image_path: performer.image_path };
            return map;
        }, {});
        UpdateAutoComplete(input, awesomplete, performers);
    };

    async function LinkPerformer(input, awesomplete) {
        const name = input.value.trim();
        if (!name) return;

        const selectedPerformer = input.performerMap[name];
        if (!selectedPerformer) return;

        const performers = JSON.parse(sessionStorage.getItem('AllPerformers'));
        const currentPerformer = await FindPerformer();
        const relatedPerformers = currentPerformer.hasOwnProperty('relatedPerformers') ? currentPerformer.relatedPerformers.toString().split('|') : [];

        performers.forEach((performer) => { if (performer.name == name && !relatedPerformers.includes(performer.id)) relatedPerformers.push(performer.id) });
        await UpdatePerformer(relatedPerformers);
    };

    async function FindPerformer() {

        var id = window.location.href.split('/')[4];
        var query = `query {findPerformer(id:${id}){custom_fields}}`;

        try {
            var response = await fetch(GetApiUrl(), {

                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${server.key}`
                },
                body: JSON.stringify({ query })
            });

            var relatedPerformers = await response.json();

            return relatedPerformers.data.findPerformer.custom_fields;

        } catch (error) {

            console.error('Error fetching scene:', error);
        };
    };

    async function UpdatePerformer(relatedPerformers) {

        const id = window.location.href.split('/')[4];
        relatedPerformers = relatedPerformers.join('|').toString();
        let query = `mutation {performerUpdate(input: {id:${id} custom_fields:{partial:{relatedPerformers:"${relatedPerformers}"}}}){id}}`;

        try {
            var response = await fetch(GetApiUrl(), {

                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${server.key}`
                },
                body: JSON.stringify({ query })
            });
            ShowRelated();
            return;

        } catch (error) {

            console.error('Error fetching scene:', error);
        };
    };

    async function ShowRelated() {
        const id = window.location.href.split('/')[4];
        const performerList = JSON.parse(sessionStorage.getItem('AllPerformers'));
        let currentPerfomer = await FindPerformer();
        let relatedPerformers = []

        if (!currentPerfomer.hasOwnProperty('relatedPerformers') || !performerList) return;
        currentPerfomer = currentPerfomer.relatedPerformers.toString().split('|')

        performerList.forEach((performer) => {
            if (currentPerfomer.includes(performer.id)) relatedPerformers.push(performer);
        });

        let { scheme, host, port } = server;
        let baseLink = `${scheme}://${host}:${port}/performers/`;

        let relatedContainer = document.querySelector('#relatedContainer');

        if (!relatedContainer) {
            relatedContainer = document.createElement('div');
            relatedContainer.className = 'row';
            relatedContainer.id = 'relatedContainer';
            relatedContainer.style.justifyContent = 'center';
            let titleContainer = document.createElement('h3');
            titleContainer.innerText = 'Related Performers';
            titleContainer.style.textAlign = 'center';
            relatedTabContent.appendChild(titleContainer);
        };

        relatedPerformers.forEach((performer, i) => {

			if (document.querySelector(`#related-performer-${performer.id}`)) return;

            let card = document.createElement('div');
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.padding = '0 .5vw';
			card.id = `related-performer-${performer.id}`;

            let link = document.createElement('a');
            link.href = `${baseLink}${performer.id}`;
            link.innerText = performer.name;
            link.target = '_blank';
            link.style.fontSize = '1vw';

            let image = document.createElement('img');
            image.src = performer.image_path;
            image.style.width = '100px';
            image.style.height = '200px';

            let divider = document.createElement('hr');
            divider.style.height = '-webkit-fill-available';
            divider.style.borderLeft = '.1vw solid';
            divider.style.borderRight = '.1vw solid';

            card.appendChild(link);
            card.appendChild(image);
            relatedContainer.appendChild(card)
            if (i != relatedPerformers.length - 1) relatedContainer.appendChild(divider);
        });

        relatedTabContent.appendChild(relatedContainer);
    };

    function SetupObserver() {
        WaitElement('.performer-head', (element => { AutoComplete(element); }));
    };

    SetupObserver();

    PluginApi.Event.addEventListener('stash:location', SetupObserver);
})();