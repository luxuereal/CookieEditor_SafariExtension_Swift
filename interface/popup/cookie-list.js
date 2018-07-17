'use strict'

var allTabs;
var loadedCookies;
var currentTabId;

$(function () {
    $('#cookie-container').on('click', 'li .header', function () {
        var $this = $(this)
        $this.parent().find('.expando').stop().slideToggle('fast');
        $this.stop().toggleClass('active');
    }); 

    $('#cookie-container').on('click', 'li .header .delete, li .expando .delete', function (e) {
        e.preventDefault();
        console.log('removing cookie...');
        var listElement = $(this).parent().parent().parent();
        removeCookie(listElement.data('name'))
        //listElement.slideUp('fast');
        return false;
    });

    $('#cookie-container').on('click', 'li .expando .save', function (e) {
        e.preventDefault();
        console.log('saving cookie...');
        var listElement = $(this).parent().parent().find('form').submit();
        return false;
    });

    $('#create-cookie').click(function (e) {
        $('#cookie-container').html('');
        $('#pageTitle').text('Cookie Editor - Create a Cookie');

        var form = createHtmlFormCookie('', '', '');
        form.addClass('create');
        $('#cookie-container').append(form);

        $('.button-bar').removeClass('active');
        $('.button-bar#button-bar-add').addClass('active');
        return false;
    });

    $('#delete-all-cookies').click(function (e) {
        for (var i = 0; i < loadedCookies.length; i++) {
            removeCookie(loadedCookies[i].name);
        }
        loadedCookies = null;
        //$('#cookie-container li').slideUp('fast');
    });

    $('#refresh-ui').click(function() {
        location.reload();
    });

    $('#return-list').click(function() {
        $('#cookie-container').html('');
        showCookiesForTab();
    });

    $('#cookie-container').on('submit', '.form', function (e) {
        e.preventDefault();
        var form = $(this);
        var name = form.find('input[name="name"]').val();
        var value = form.find('textarea[name="value"]').val();
        var cookie = loadedCookies[form.data('id')];

        if (!cookie) {
            cookie = {};
        }

        cookie.name = name;
        cookie.value = value;
        createCookie(cookie);

        if ($(this).hasClass('create')) {
            $('#return-list').click();
        } 
        return false;
    });

    $('#save-create-cookie').click(function() {
        $('.form.create').submit();
    });
});

function showCookiesForTab() {
    var url = getCurrentTabUrl();
    console.log('Getting cookies for "' + url + '"');
    chrome.runtime.sendMessage({ type: "getAllCookies", url: getCurrentTabUrl() }, function (cookies) {
        cookies = cookies.sort(sortCookiesByName);
        loadedCookies = cookies;
        $('#pageTitle').text('Cookie Editor');
        $('.button-bar').removeClass('active');
        $('.button-bar#button-bar-default').addClass('active');

        if (cookies.length > 0) {
            let list = $('<ul>');

            cookies.forEach(function (cookie, id) {
                list.append(createHtmlForCookie(cookie.name, cookie.value, id));
            });

            $('#cookie-container').html(list);
        } else {
            showNoCookies();
        }
    });
}

function showNoCookies() {
    let noCookiesText = $("<p>");
    noCookiesText.addClass('container');
    noCookiesText.text('This page does not have any cookies');
    $('#cookie-container').html(noCookiesText);
}

function createHtmlForCookie(name, value, id) {
    let element = $("<li>");
    element.data('name', name);

    var header = $('<div>').addClass('header container').text(name);
    header.prepend('<i class="fa fa-angle-down"></i>');

    var headerBtns = $('<div>').addClass('btns');
    headerBtns.append($('<button>').addClass('delete browser-style').html('<i class="fa fa-trash"></i>'));
    header.append(headerBtns);
    element.append(header);

    var expandoZone = $('<div>').addClass('expando').css('display', 'none');

    var actionBtns = $('<div>').addClass('action-btns');
    actionBtns.append($('<button>').addClass('delete').html('<i class="fa fa-trash"></i>'))
    actionBtns.append($('<button>').addClass('save').html('<i class="fa fa-check"></i>'))
    expandoZone.append(actionBtns);

    expandoZone.append(createHtmlFormCookie(name, value, id));

    element.append(expandoZone);

    return element;
}

function createHtmlFormCookie(name, value, id) {
    var formId = guid();
    var formContainer = $('<form>').addClass('form container').attr('id', formId).data('id', id);

    var inputNameContainer = $('<div>').addClass('browser-style');
    inputNameContainer.append($('<label>').addClass('browser-style').text('Name').attr('for', 'name-' + formId));
    inputNameContainer.append($('<input>').addClass('browser-style').attr('name', 'name').attr('type', 'text').attr('value', name).attr('id', 'name-' + formId));
    formContainer.append(inputNameContainer);

    var inputValueContainer = $('<div>').addClass('browser-style');
    inputValueContainer.append($('<label>').addClass('browser-style').text('Value').attr('for', 'value-' + formId));
    inputValueContainer.append($('<textarea>').addClass('browser-style').attr('name', 'value').text(value).attr('id', 'value-' + formId));
    formContainer.append(inputValueContainer);

    return formContainer;
}

function removeCookie(name, url, callback) {
    var removing = chrome.cookies.remove({
        url: url ? url : getCurrentTabUrl(),
        name: name
    }, function (e) {
        // On success
        console.log('success', e);
        if (callback) {
            callback();
        }
    });
}

function createCookie(cookie) {
    var newCookie = {
        domain: cookie.domain || '',
        name: cookie.name || '',
        value: cookie.value || '',
        path: cookie.path || null,
        secure: cookie.secure || null,
        httpOnly: cookie.httpOnly || null,
        sameSite: cookie.sameSite || null,
        expirationDate: cookie.expirationDate || null,
        storeId: cookie.storeId || null,
        url: getCurrentTabUrl(),
    }
    
    chrome.cookies.set(newCookie, function (e) {
        // On success
    });
}

function onCookiesChanged(changeInfo) {
    var domain = changeInfo.cookie.domain.substring(1);
    console.log(getCurrentTabUrl(), domain, changeInfo)
    if (getCurrentTabUrl().indexOf(domain) !== -1) {
        showCookiesForTab();
        console.log('Cookies have changed!');
    }
}

function onTabsChanged(tabId, changeInfo, tab) {
    if (changeInfo.url || changeInfo.status === 'complete') {
        showCookiesForTab();
        console.log('Tab has changed!');
    }
}

function onTabActivated(activeInfo) {
    console.log('Tab activated!');
    currentTabId = activeInfo.tabId;
    showCookiesForTab();
}

function sortCookiesByName(a, b) {
    var aName = a.name.toLowerCase();
    var bName = b.name.toLowerCase();
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

function initWindow(tabs) {
    console.log('initiating...');
    allTabs = tabs;
    //chrome.cookies.onChanged.addListener(onCookiesChanged);
    //chrome.tabs.onUpdated.addListener(onTabsChanged);
    //chrome.tabs.onActivated.addListener(onTabActivated);
    //chrome.tabs.query({active: true, currentWindow: true}, function(tabInfo) {
    //});
    chrome.runtime.sendMessage({ type: "getCurrentTab" }, function (tabInfo) {
        console.log('Got current tab info', tabInfo);
        currentTabId = tabInfo[0].id;
        showCookiesForTab();
    });
}

function getCurrentTab() {
    if (!allTabs) {
        console.log('no tabs found');
        return null;
    }
    console.log(allTabs.length + ' tabs, getting current tab id "' + currentTabId + '"..');
    for (let tab of allTabs) {
        if (tab.id === currentTabId) {
            return tab;
        }
    }
    console.log('Tab not found');
    return null;
}

function getCurrentTabUrl() {
    if (getCurrentTab()) {
        return getCurrentTab().url;
    }
    return '';
}

chrome.runtime.sendMessage({ type: "getTabs" }, function (response) {
    initWindow(response); 
});

if (chrome.runtime.getBrowserInfo) {
    chrome.runtime.getBrowserInfo(function (info) {
        var mainVersion = info.version.split('.')[0];
        if (mainVersion < 57) {
            $('#cookie-container').css('height', '600px');
        }
    });
}