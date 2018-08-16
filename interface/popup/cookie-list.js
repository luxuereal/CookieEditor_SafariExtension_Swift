(function () {
    'use strict';

    let containerCookie;
    let notificationElement;
    let loadedCookies;

    let notificationQueue = [];
    let notificationTimeout;

    const cookieHandler = new CookieHandler();

    document.addEventListener('DOMContentLoaded', function () {
        containerCookie = document.getElementById('cookie-container');
        notificationElement = document.getElementById('notification');

        function expandCookie(e) {
            const parent = e.target.closest('li');
            toggleSlide(parent.querySelector('.expando'));
            parent.querySelector('.header').classList.toggle('active');
        }

        function deleteButton(e) {
            e.preventDefault();
            console.log('removing cookie...');
            const listElement = e.target.closest('li');
            removeCookie(listElement.dataset.name);
            return false;
        }

        function saveCookieForm(form) {
            const id = form.dataset.id;
            const name = form.querySelector('input[name="name"]').value;
            const value = form.querySelector('textarea[name="value"]').value;
            saveCookie(id, name, value);

            if (form.classList.contains('create')) {
                returnToList();
            }
            return false;
        }

        function saveCookie(id, name, value) {
            console.log('saving cookie...');

            let cookie = loadedCookies[id];
            let oldName;

            if (cookie) {
                oldName = cookie.name;
            } else {
                cookie = {};
                oldName = name;
            }

            cookie.name = name;
            cookie.value = value;
            cookieHandler.removeCookie(oldName, getCurrentTabUrl(), function () {
                cookieHandler.saveCookie(cookie, getCurrentTabUrl());
            });
        }

        function returnToList() {
            containerCookie.innerHTML = '';
            showCookiesForTab();
        }

        if (containerCookie) {
            containerCookie.addEventListener('click', e => {
                let target = e.target;
                if (target.nodeName === 'path') {
                    target = target.parentNode;
                }
                if (target.nodeName === 'svg') {
                    target = target.parentNode;
                }

                if (target.classList.contains('header')) {
                    return expandCookie(e);
                }
                if (target.classList.contains('delete')) {
                    return deleteButton(e);
                }
                if (target.classList.contains('save')) {
                    return saveCookieForm(e.target.closest('li').querySelector('form'));
                }
            });
        }

        document.getElementById('create-cookie').addEventListener('click', () => {
            containerCookie.innerHTML = '';
            let pageTitle = document.getElementById('pageTitle');
            if (pageTitle) {
                pageTitle.innerHTML = 'Cookie Editor - Create a Cookie';
            }

            containerCookie.innerHTML = createHtmlFormCookie('', '', '');

            document.getElementById('button-bar-default').classList.remove('active');
            document.getElementById('button-bar-add').classList.add('active');
            return false;
        });

        document.getElementById('delete-all-cookies').addEventListener('click', () => {
            let buttonIcon = document.getElementById('delete-all-cookies').querySelector('use');
            if (buttonIcon.getAttribute("xlink:href") === "../sprites/solid.svg#check") {
                return;
            }
            if (loadedCookies && loadedCookies.length) {
                for (let i = 0; i < loadedCookies.length; i++) {
                    removeCookie(loadedCookies[i].name);
                }
                loadedCookies = null;
            }
            sendNotification('All cookies were deleted');
            buttonIcon.setAttribute("xlink:href", "../sprites/solid.svg#check");
            setTimeout(() => {
                buttonIcon.setAttribute("xlink:href", "../sprites/solid.svg#trash");
            }, 1500);
        });

        document.getElementById('export-cookies').addEventListener('click', () => {
            let buttonIcon = document.getElementById('export-cookies').querySelector('use');
            if (buttonIcon.getAttribute("xlink:href") === "../sprites/solid.svg#check") {
                return;
            }

            buttonIcon.setAttribute("xlink:href", "../sprites/solid.svg#check"); 
            copyText(JSON.stringify(loadedCookies, null, 4));

            sendNotification('Cookies exported to clipboard');
            setTimeout(() => {
                buttonIcon.setAttribute("xlink:href", "../sprites/solid.svg#file-export");
            }, 1500);
        });

        document.getElementById('import-cookies').addEventListener('click', () => {
            containerCookie.innerHTML = '';
            let pageTitle = document.getElementById('pageTitle');
            if (pageTitle) {
                pageTitle.innerHTML = 'Cookie Editor - Import Cookies from Json';
            }

            containerCookie.innerHTML = createHtmlFormImport();

            document.getElementById('button-bar-default').classList.remove('active');
            document.getElementById('button-bar-import').classList.add('active');
            return false;
        });

        document.getElementById('return-list-add').addEventListener('click', () => {
            returnToList();
        });
        document.getElementById('return-list-import').addEventListener('click', () => {
            returnToList();
        });

        containerCookie.addEventListener('submit', e => {
            e.preventDefault();
            saveCookieForm(e.target);
            return false;
        });

        document.getElementById('save-create-cookie').addEventListener('click', () => {
            saveCookieForm(document.querySelector('form'));
        });

        document.getElementById('save-import-cookie').addEventListener('click', e => {
            let buttonIcon = document.getElementById('save-import-cookie').querySelector('use');
            if (buttonIcon.getAttribute("xlink:href") !== "../sprites/solid.svg#file-export") {
                return;
            }

            let json = document.querySelector('textarea').value;
            if (!json) {
                return;
            }

            let cookies;
            try {
                cookies = JSON.parse(json);
            } catch (error) {
                console.log("Couldn't parse Json", error);
                sendNotification("Could not parse the Json value");
                buttonIcon.setAttribute("xlink:href", "../sprites/solid.svg#times");
                setTimeout(() => {
                    buttonIcon.setAttribute("xlink:href", "../sprites/solid.svg#file-export");
                }, 1500);
                return;
            }

            if (!isArray(cookies)) {
                console.log("Invalid Json");
                sendNotification("The Json is not valid");
                buttonIcon.setAttribute("xlink:href", "../sprites/solid.svg#times");
                setTimeout(() => {
                    buttonIcon.setAttribute("xlink:href", "../sprites/solid.svg#file-export");
                }, 1500);
                return;
            }

            cookies.forEach(cookie => {
                cookieHandler.saveCookie(cookie, getCurrentTabUrl(), function(error, cookie) {
                    if (error) {
                        sendNotification(error);
                    }
                });
            });

            sendNotification('Cookies were created');
            showCookiesForTab();
        });

        notificationElement.addEventListener('animationend', e => {
            if (notificationElement.classList.contains('fadeInUp')) {
                return;
            }

            triggerNotification();
        });

        document.getElementById('notification-dismiss').addEventListener('click', e => {
            hideNotification();
        });

        initWindow();
        showCookiesForTab();

        if (chrome.runtime.getBrowserInfo) {
            chrome.runtime.getBrowserInfo(function (info) {
                const mainVersion = info.version.split('.')[0];
                if (mainVersion < 57) {
                    containerCookie.style.height = '600px';
                }
            });
        }
    });

    // == End document ready == //

    function showCookiesForTab() {
        if (!cookieHandler.currentTab) {
            return;
        }
        const domain = getDomainFromUrl(cookieHandler.currentTab.url);
        const subtitleLine = document.querySelector('.titles h2');
        if (subtitleLine) {
            subtitleLine.innerHTML = domain || cookieHandler.currentTab.url;
        }
        
        cookieHandler.getAllCookies(function (cookies) {
            cookies = cookies.sort(sortCookiesByName);
            loadedCookies = cookies;
            let pageTitle = document.getElementById('pageTitle');
            if (pageTitle) {
                pageTitle.innerHTML = 'Cookie Editor';
            }

            document.getElementById('button-bar-add').classList.remove('active');
            document.getElementById('button-bar-import').classList.remove('active');
            document.getElementById('button-bar-default').classList.add('active');

            if (cookies.length > 0) {
                let cookiesHtml = '';
                cookies.forEach(function (cookie, id) {
                    cookiesHtml += createHtmlForCookie(cookie.name, cookie.value, id);
                });

                containerCookie.innerHTML = `
                    <ul>
                        ${cookiesHtml}
                    </ul>
                `;
            } else {
                showNoCookies();
            }
        });
    }

    function showNoCookies() {
        containerCookie.innerHTML = `
            <p class="container" id="no-cookies">
                This page does not have any cookies
            </p>
        `;
    }

    function createHtmlForCookie(name, value, id) {
        let formHtml = createHtmlFormCookie(name, value, id);
        return `
            <li data-name="${name}">
                <div class="header container">
                    <svg class="icon arrow"><use xlink:href="../sprites/solid.svg#angle-down"></use></svg>
                    ${name}
                    <div class="btns">
                        <button class="delete browser-style">
                            <svg class="icon"><use xlink:href="../sprites/solid.svg#trash"></use></svg>
                        </button>
                    </div>
                </div>
                <div class="expando">
                    <div class="wrapper">
                        <div class="action-btns">
                            <button class="delete"><svg class="icon"><use xlink:href="../sprites/solid.svg#trash"></use></svg></button>
                            <button class="save"><svg class="icon"><use xlink:href="../sprites/solid.svg#check"></use></svg></button>
                        </div>
                        ${formHtml}
                    </div>
                </div>
            </li>
        `;
    }

    function createHtmlFormCookie(name, value, id) {
        const formId = guid();
        return `
            <form data-id="${id}" class="form container ${!id ? `create` : ''}" id="${formId}">
                <div class="browser-style">
                    <label class="browser-style" for="name-${formId}">Name</label>
                    <input class="browser-style" name="name" type="text" value="${name}" id="name-${formId}" />
                </div>
                <div class="browser-style">
                    <label class="browser-style" for="value-${formId}">Value</label>
                    <textarea class="browser-style" name="value" id="value-${formId}">${value}</textarea>
                </div>
            </form>
        `;
    }

    function createHtmlFormImport() {
        const formId = guid();
        return `
            <form class="form container import" id="${formId}">
                <div class="browser-style">
                    <label class="browser-style" for="content-${formId}">Json</label>
                    <textarea class="browser-style json" name="content" id="content-${formId}" placeholder="Paste your Json here"></textarea>
                </div>
            </form>
        `;
    }

    function removeCookie(name, url, callback) {
        const removing = cookieHandler.removeCookie(name, url || getCurrentTabUrl(), function (e) {
            console.log('success', e);
            if (callback) {
                callback();
            }
        });
    }

    function onCookiesChanged(changeInfo) {
        showCookiesForTab();
        console.log('Cookies have changed!');
    }

    function onCookieHandlerReady() {
        showCookiesForTab();
    }

    function onTabActivated(activeInfo) {
        updateCurrentTab();
    }

    function sortCookiesByName(a, b) {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
    }

    function guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }

    function initWindow(tab) {
        cookieHandler.on('cookiesChanged', onCookiesChanged);
        cookieHandler.on('ready', onCookieHandlerReady);
    }

    function getCurrentTabUrl() {
        if (cookieHandler.currentTab) {
            return cookieHandler.currentTab.url;
        }
        return '';
    }

    function sendMessage(type, params, callback, errorCallback) {
        if (window.browser) {
            const sending = browser.runtime.sendMessage({type: type, params: params});
            sending.then(callback, errorCallback);  
        } else {
            chrome.runtime.sendMessage({ type: type, params: params }, callback);
        }
    }

    function getDomainFromUrl(url) {
        const matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
        return matches && matches[1];
    }

    function sendNotification(message) {
        notificationQueue.push(message);
        triggerNotification();
    }

    function triggerNotification() {
        if (!notificationQueue || !notificationQueue.length) {
            return;
        }
        if (notificationTimeout) {
            return;
        }
        if (notificationElement.classList.contains('fadeInUp')) {
            return;
        }

        showNotification();
    }

    function showNotification() {
        if (notificationTimeout) {
            return;
        }

        notificationElement.querySelector('span').innerHTML = notificationQueue.shift();
        notificationElement.classList.add('fadeInUp');
        notificationElement.classList.remove('fadeOutDown');

        notificationTimeout = setTimeout(() => {
            hideNotification();
        }, 2500);
    }

    function hideNotification() {
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
            notificationTimeout = null;
        }
        notificationElement.classList.remove('fadeInUp');
        notificationElement.classList.add('fadeOutDown');
    }
}());

/** 
 * getHeight - for elements with display:none 
 * https://stackoverflow.com/a/29047447
 **/
function getHeight(el) {
    const elStyle = window.getComputedStyle(el);
    const elMaxHeight = elStyle.maxHeight;
    const elMaxHeightInt = elMaxHeight.replace('px', '').replace('%', '');

    // if its not hidden we just return normal height
    if (elMaxHeightInt !== '0') {
        return el.offsetHeight;
    }

    // the element is hidden so:
    // making the el block so we can meassure its height but still be hidden
    el.style.position = 'absolute';
    el.style.visibility = 'hidden';
    el.style.display = 'block';
    el.style.maxHeight = 'none';

    let wantedHeight = el.offsetHeight;

    // reverting to the original values
    el.style.display = '';
    el.style.position = '';
    el.style.visibility = '';
    el.style.maxHeight = elMaxHeight;

    return wantedHeight;
}

function toggleSlide(el) {
    let elMaxHeight = 0;

    if (el.getAttribute('data-max-height')) {
        // we've already used this before, so everything is setup
        if (el.style.maxHeight.replace('px', '').replace('%', '') === '0') {
            el.style.maxHeight = el.getAttribute('data-max-height');
        } else {
            elMaxHeight = getHeight(el) + 'px';
            el.setAttribute('data-max-height', elMaxHeight);
            el.style.maxHeight = '0';
        }
    } else {
        elMaxHeight = getHeight(el) + 'px';
        el.style.transition = 'max-height 0.2s ease-in-out';
        el.style.overflowY = 'hidden';
        el.style.maxHeight = '0';
        el.setAttribute('data-max-height', elMaxHeight);
        el.style.display = 'flex';

        // we use setTimeout to modify maxHeight later than display (to we have the transition effect)
        setTimeout(function () {
            el.style.maxHeight = elMaxHeight;
        }, 10);
    }
}

function copyText(text) {
    const fakeText = document.createElement('textarea');
    fakeText.classList.add('clipboardCopier');
    fakeText.innerHTML = text;
    document.body.appendChild(fakeText);
    fakeText.focus();
    fakeText.select();
    document.execCommand('Copy');
    document.body.removeChild(fakeText);
}

function isArray(value) {
    return value && typeof value === 'object' && value.constructor === Array;
}