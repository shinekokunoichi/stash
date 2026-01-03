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

    async function AutoComplete(container) {

        if (container.querySelector('#scene-autocomplete')) return;

        const group = document.createElement('div');
        group.className = 'form-group row autocomplete-container';

        const label = document.createElement('label');
        label.setAttribute('for', 'scene-autocomplete');
        label.className = 'form-label col-form-label col-sm-12';
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

        container.append(group);

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
        console.log(currentPerfomer)
        currentPerfomer = currentPerfomer.relatedPerformers.toString().split('|')
        console.log(currentPerfomer)

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
            let titleContainer = document.createElement('h6');
            titleContainer.innerText = 'Related Performers';
            document.querySelector('.performer-head').appendChild(titleContainer);
        };

        relatedPerformers.forEach((performer) => {
            let link = document.createElement('a');
            link.href = `${baseLink}${performer.id}`;
            link.innerText = performer.name;
            link.target = '_blank';
            relatedContainer.appendChild(link);
            let divider = document.createElement('p');
            divider.innerText = ' | ';
            divider.style = 'margin: 0 0.2vw';
            relatedContainer.append(divider);
        });

        document.querySelector('.performer-head').appendChild(relatedContainer);
    };

    function SetupObserver() {
        WaitElement('.performer-head', (element => { AutoComplete(element); }));
    };

    SetupObserver();

    PluginApi.Event.addEventListener('stash:location', SetupObserver);
})();