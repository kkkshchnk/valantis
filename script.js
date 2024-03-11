const apiUrl = 'http://api.valantis.store:40000/';

async function sendRequest(action, params = {}) {
    const requestData = { action, params };
    console.log('Отправка запроса:', requestData);

    const password = 'Valantis';
    const timestamp = new Date().toISOString().slice(0, 10).split('-').join('');
    const data = `${password}_${timestamp}`;
    const authorizationString = CryptoJS.MD5(data).toString();

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth': authorizationString
            },
            body: JSON.stringify(requestData)
        });
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        const responseData = await response.json();
        console.log('Ответ от сервера:', responseData);
        return responseData;
    } catch (error) {
        console.error('API Error:', error);
        console.log('Повторный запрос...');
        return sendRequest(action, params);
    }
}

function displayProducts(products, pageNum) {
    console.log('Отображение товаров:', products);
    const productList = $('#product-list');
    productList.empty();

    const tableHeader = `
        <tr>
            <th>№</th>
            <th>ID</th>
            <th>Название</th>
            <th>Цена</th>
            <th>Бренд</th>
        </tr>
    `;
    productList.append(tableHeader);

    const startNumber = (pageNum - 1) * 50 + 1;

    products.forEach((result, index) => {
        const tableRow = `
            <tr>
                <td>${startNumber + index}</td>
                <td>${result.id}</td>
                <td>${result.product}</td>
                <td>${result.price}</td>
                <td>${result.brand ? result.brand : 'Не указан'}</td>
            </tr>
        `;
        productList.append(tableRow);
    });

    console.log('Товары отображены на странице в виде таблицы.');
}

let currentPage = 1;
let totalPages = 0;
let currentFilters = {};

async function loadPageWithFilters(pageNum, filters = {}) {
    try {
        if (JSON.stringify(filters) !== JSON.stringify(currentFilters)) {
            currentFilters = filters;
            pageNum = 1;
        }

        const responseIds = await sendRequest(filters.brand || filters.price || filters.name ? 'get_ids' : 'get_ids', filters);
        const ids = responseIds.result;

        const uniqueIds = [...new Set(ids)];
        const startIdx = (pageNum - 1) * 50;
        const endIdx = Math.min(startIdx + 50, uniqueIds.length);

        const responseItems = await sendRequest('get_items', { ids });

        const filteredItems = responseItems.result.filter(item => {
            let meetsFilterCriteria = true;
            if (filters.name && !item.product.includes(filters.name)) {
                meetsFilterCriteria = false;
            }
            if (filters.price && parseFloat(item.price) !== parseFloat(filters.price)) {
                meetsFilterCriteria = false;
            }
            if (filters.brand && item.brand !== filters.brand) {
                meetsFilterCriteria = false;
            }
            return meetsFilterCriteria;
        });

        const filteredAndUniqueItems = filteredItems.reduce((uniqueItems, item) => {
            const found = uniqueItems.find(uniqueItem => uniqueItem.id === item.id);
            if (!found) {
                uniqueItems.push(item);
            }
            return uniqueItems;
        }, []);

        const totalPages = Math.ceil(filteredAndUniqueItems.length / 50);
        displayProducts(filteredAndUniqueItems.slice(startIdx, endIdx), pageNum);
        updatePagination(totalPages);
    } catch (error) {
        console.error('Ошибка при загрузке страницы:', error);
    }
}

async function loadPage(pageNum, filters = {}) {
    await loadPageWithFilters(pageNum, filters);
}

$('#filter-form').submit(function(event) {
    event.preventDefault();
    const name = $('#name-filter').val().trim();
    const price = $('#price-filter').val().trim();
    const brand = $('#brand-filter').val().trim();
    currentFilters = {};
    if (name !== '') currentFilters.name = name;
    if (price !== '') currentFilters.price = price;
    if (brand !== '') currentFilters.brand = brand;
    loadPageWithFilters(1, currentFilters);
});

$('#reset-filters').click(function() {
    $('#name-filter').val('');
    $('#price-filter').val('');
    $('#brand-filter').val('');
    currentFilters = {};
    loadPageWithFilters(1);
});

function updatePagination(totalPages) {
    $('#pagination').empty();
    if (totalPages <= 1) return;

    if (currentPage > 1) {
        $('#pagination').append(`<button class="pagination-btn" id="prevPage">Предыдущая страница</button>`);
    }

    if (totalPages <= 2) {
        $('#pagination').append(`<button class="pagination-btn pageBtn" data-page="1">1</button>`);
    } else {
        $('#pagination').append(`<button class="pagination-btn pageBtn" data-page="1">1</button>`);
        $('#pagination').append(`<button class="pagination-btn pageBtn" data-page="2">2</button>`);

        if (currentPage > 2) {
            $('#pagination').append(`<button class="ellipsis" disabled>...</button>`);
        }

        const startPage = Math.max(3, currentPage - 1);
        const endPage = Math.min(totalPages - 1, currentPage + 1);

        for (let i = startPage; i <= endPage; i++) {
            $('#pagination').append(`<button class="pagination-btn pageBtn" data-page="${i}">${i}</button>`);
        }

        if (currentPage < totalPages - 1) {
            $('#pagination').append(`<button class="ellipsis" disabled>...</button>`);
        }

        $('#pagination').append(`<button class="pagination-btn pageBtn" data-page="${totalPages}">${totalPages}</button>`);
    }

    if (currentPage < totalPages) {
        $('#pagination').append(`<button class="pagination-btn" id="nextPage">Следующая страница</button>`);
    }
}


$(document).on('click', '.ellipsis', function() {
    const pageNum = parseInt($(this).prev().attr('data-page')) + 1;
    updatePagination(totalPages);
    loadPage(pageNum);
});

$(document).on('click', '#nextPage', function() {
    currentPage++;
    loadPage(currentPage, currentFilters);
});

$(document).on('click', '#prevPage', function() {
    if (currentPage > 1) {
        currentPage--;
        loadPage(currentPage, currentFilters);
    }
});

$(document).on('click', '.pageBtn', function() {
    const pageNum = parseInt($(this).attr('data-page'));
    currentPage = pageNum;
    loadPage(currentPage, currentFilters);
});


$(document).ready(function() {
    loadPage(currentPage);
});
