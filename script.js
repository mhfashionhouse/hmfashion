document.addEventListener('DOMContentLoaded', function() {
    // Helper function to get cookie value
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return '';
    }

    // Get all product items
    const productItems = document.querySelectorAll('.product-item');
    
    // Product prices
    const BASE_PRICE = 750;
    const HIJAB_PRICE = 1050;
    const SHIPPING_DHAKA = 80;
    const SHIPPING_OUTSIDE = 150;

    // Facebook Pixel helper function with deduplication
    const trackedEvents = new Set();
    function trackFBEvent(eventName, params, uniqueIdentifier = '') {
        try {
            if (typeof fbq !== 'function') {
                console.warn('Facebook Pixel not loaded');
                return;
            }

            // Create a unique key for this event
            const eventKey = `${eventName}-${uniqueIdentifier || Date.now()}`;
            if (trackedEvents.has(eventKey)) {
                return; // Skip if this exact event was already tracked
            }
            
            // Get Facebook IDs and parameters
            const fbc = getCookie('_fbc') || '';
            const fbp = getCookie('_fbp') || '';
            const fbLoginId = localStorage.getItem('fb_login_id');
            
            // Ensure required parameters are present
            const eventParams = {
                currency: 'BDT',
                ...params,
                // Add Facebook identifiers
                fb_login_id: fbLoginId || undefined,
                fbc: fbc || undefined,
                fbp: fbp || undefined
            };
            
            // Clean up undefined values
            Object.keys(eventParams).forEach(key => 
                eventParams[key] === undefined && delete eventParams[key]
            );
            
            // Validate and format value parameter
            if (eventParams.value) {
                eventParams.value = parseFloat(eventParams.value) || 0;
            }

            // Add required parameters for specific events
            if (eventName === 'InitiateCheckout' || eventName === 'Purchase') {
                if (!eventParams.contents) {
                    const selectedProducts = getSelectedProducts();
                    eventParams.contents = selectedProducts.map(p => ({
                        id: p.name,
                        quantity: p.quantity,
                        item_price: p.price
                    }));
                    eventParams.content_type = 'product';
                    eventParams.num_items = selectedProducts.reduce((sum, p) => sum + p.quantity, 0);
                }
            }
            
            // Skip pixel tracking for Purchase events to avoid duplication
            if (eventName !== 'Purchase') {
                fbq('track', eventName, eventParams);
                trackedEvents.add(eventKey);
            }
        } catch (error) {
            console.error('Error tracking FB event:', error);
        }
    }

    // Helper function to get selected products info
    function getSelectedProducts() {
        const products = [];
        productItems.forEach((item) => {
            if (item.classList.contains('selected')) {
                const name = item.querySelector('h4').textContent;
                const size = item.querySelector('.size-btn.selected')?.textContent;
                const quantity = parseInt(item.querySelector('.quantity').value) || 1;
                const withHijab = item.querySelector('input[value="with"]').checked;
                const price = withHijab ? HIJAB_PRICE : BASE_PRICE;
                
                products.push({
                    name,
                    size,
                    quantity,
                    price,
                    withHijab
                });
            }
        });
        return products;
    }

    productItems.forEach((item, index) => {
        const quantityInput = item.querySelector('.quantity');
        const minusBtn = item.querySelector('.minus');
        const plusBtn = item.querySelector('.plus');
        const sizeButtons = item.querySelectorAll('.size-btn');
        const hijabRadios = item.querySelectorAll('input[type="radio"]');
        const priceElement = item.querySelector('.price');
        const originalPriceElement = item.querySelector('.original-price');

        // Disable all controls initially
        sizeButtons.forEach(btn => btn.style.pointerEvents = 'none');
        hijabRadios.forEach(radio => radio.disabled = true);
        if (quantityInput) {
            quantityInput.disabled = true;
            minusBtn.style.pointerEvents = 'none';
            plusBtn.style.pointerEvents = 'none';
        }

        // Product card selection
        item.addEventListener('click', function(e) {
            // Don't toggle if clicking on controls
            if (e.target.closest('.size-btn') || 
                e.target.closest('.quantity-control') || 
                e.target.closest('.hijab-option')) {
                return;
            }
            
            const wasSelected = this.classList.contains('selected');
            
            if (wasSelected) {
                // Reset all selections for this product
                sizeButtons.forEach(btn => {
                    btn.classList.remove('selected');
                    btn.style.pointerEvents = 'none';
                });
                hijabRadios.forEach(radio => {
                    radio.checked = false;
                    radio.disabled = true;
                });
                if (quantityInput) {
                    quantityInput.value = '1';
                    quantityInput.disabled = true;
                    minusBtn.style.pointerEvents = 'none';
                    plusBtn.style.pointerEvents = 'none';
                }
                // Reset price to base price
                if (priceElement) {
                    priceElement.textContent = `৳ ${BASE_PRICE}`;
                }
            } else {
                // Enable controls when card is selected
                sizeButtons.forEach(btn => btn.style.pointerEvents = 'auto');
                hijabRadios.forEach(radio => radio.disabled = false);
                if (quantityInput) {
                    quantityInput.disabled = false;
                    minusBtn.style.pointerEvents = 'auto';
                    plusBtn.style.pointerEvents = 'auto';
                }
            }
            
            this.classList.toggle('selected');
            updateOrderSummary();
            
            // Track product selection with Facebook
            if (!wasSelected) {
                const productName = this.querySelector('h4').textContent;
                const selectedSize = this.querySelector('.size-btn.selected')?.textContent;
                const quantity = parseInt(this.querySelector('.quantity').value) || 1;
                const withHijab = this.querySelector('input[value="with"]').checked;
                const price = withHijab ? HIJAB_PRICE : BASE_PRICE;
                
                trackFBEvent('AddToCart', {
                    content_name: productName,
                    content_type: 'product',
                    content_ids: [productName],
                    contents: [{
                        id: productName,
                        quantity: quantity,
                        item_price: price
                    }],
                    value: price * quantity
                }, productName); // Add unique identifier
            }
        });
        
        // Size selection
        sizeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                sizeButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                updateOrderSummary();
            });
        });

        // Quantity controls
        if (minusBtn && plusBtn && quantityInput) {
            minusBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                let value = parseInt(quantityInput.value);
                if (value > 1) {
                    quantityInput.value = value - 1;
                    updatePrice(item);
                    updateOrderSummary();
                }
            };
            
            plusBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                let value = parseInt(quantityInput.value);
                if (value < 10) {
                    quantityInput.value = value + 1;
                    updatePrice(item);
                    updateOrderSummary();
                }
            };

            // Prevent manual input
            quantityInput.addEventListener('keydown', (e) => {
                e.preventDefault();
            });
        }

        // Hijab radio change
        hijabRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                e.stopPropagation();
                updatePrice(item);
                updateOrderSummary();
            });
        });
    });

    // Shipping options
    const shippingOptions = document.querySelectorAll('input[name="shipping"]');
    const orderForm = document.getElementById('orderForm');
    
    // Update price when hijab option changes
    document.querySelectorAll('.hijab-option input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const productItem = this.closest('.product-item');
            updatePrice(productItem);
            updateOrderSummary();
        });
    });

    // Update shipping cost when option changes
    shippingOptions.forEach(radio => {
        radio.addEventListener('change', function() {
            updateOrderSummary();
        });
    });

    function updatePrice(item) {
        const quantityInput = item.querySelector('.quantity');
        const priceElement = item.querySelector('.price');
        const originalPriceElement = item.querySelector('.original-price');
        const withHijab = item.querySelector('input[value="with"]').checked;
        const quantity = parseInt(quantityInput.value) || 1;
        
        const basePrice = withHijab ? HIJAB_PRICE : BASE_PRICE;
        const originalPrice = Math.ceil(basePrice * 1.2); // 20% higher price
        const total = basePrice * quantity;
        const originalTotal = originalPrice * quantity;
        
        originalPriceElement.textContent = `৳ ${originalTotal}`;
        priceElement.textContent = `৳ ${total}`;
    }

    function updateOrderSummary() {
        const selectedProductInfo = document.getElementById('selected-product-info');
        const productPriceElement = document.getElementById('product-price');
        const deliveryChargeElement = document.getElementById('delivery-charge');
        const totalPriceElement = document.getElementById('total-price');
        
        let summaryText = '';
        let subtotal = 0;

        productItems.forEach((item, index) => {
            const selectedSize = item.querySelector('.size-btn.selected');
            const selectedHijab = item.querySelector('input[type="radio"]:checked');
            const quantity = parseInt(item.querySelector('.quantity').value);
            const productName = item.querySelector('h4').textContent;

            if (selectedSize || selectedHijab) {
                const withHijab = item.querySelector('input[value="with"]').checked;
                const basePrice = withHijab ? HIJAB_PRICE : BASE_PRICE;
                const itemTotal = basePrice * quantity;
                subtotal += itemTotal;

                if (summaryText) summaryText += '<br>';
                summaryText += `${productName} - সাইজ: ${selectedSize ? selectedSize.textContent : ''} - ${selectedHijab ? (selectedHijab.value === 'with' ? 'হিজাবসহ' : 'হিজাব ছাড়া') : ''} - ${quantity}টি - ৳${itemTotal}`;
            }
        });

        // Update summary display with proper formatting
        selectedProductInfo.innerHTML = summaryText || 'কোনো পণ্য নির্বাচন করা হয়নি';
        
        // Calculate shipping and total
        const shippingDhaka = document.querySelector('input[value="dhaka"]').checked;
        const shippingCost = shippingDhaka ? SHIPPING_DHAKA : SHIPPING_OUTSIDE;
        
        productPriceElement.textContent = `৳ ${subtotal}`;
        deliveryChargeElement.textContent = `৳ ${shippingCost}`;
        totalPriceElement.textContent = `৳ ${subtotal + shippingCost}`;
    }

    // Event listener for shipping options
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', updateOrderSummary);
    });

    // Initialize order summary
    updateOrderSummary();

    function showValidationMessage(message) {
        const validationMessage = document.getElementById('validationMessage');
        validationMessage.textContent = message;
        validationMessage.classList.add('show');
        
        // Scroll to the validation message
        validationMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideValidationMessage() {
        const validationMessage = document.getElementById('validationMessage');
        validationMessage.classList.remove('show');
    }

    function scrollToForm() {
        const orderForm = document.querySelector('.order-form');
        orderForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function showProductWarning(message) {
        const warningElement = document.getElementById('productWarning');
        warningElement.textContent = message;
        warningElement.classList.add('show');

        // Highlight all product items
        document.querySelectorAll('.product-item').forEach(item => {
            item.classList.add('highlight');
        });

        // Scroll to product selection
        document.getElementById('product-selection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
        });

        // Remove highlight after 2 seconds
        setTimeout(() => {
            document.querySelectorAll('.product-item').forEach(item => {
                item.classList.remove('highlight');
            });
        }, 2000);
    }

    function hideProductWarning() {
        const warningElement = document.getElementById('productWarning');
        warningElement.classList.remove('show');
        document.querySelectorAll('.product-item').forEach(item => {
            item.classList.remove('highlight');
        });
    }

    function validateForm() {
        const nameInput = document.querySelector('input[type="text"]');
        const addressInput = document.querySelector('textarea');
        const phoneInput = document.querySelector('input[type="tel"]');
        const placeOrderBtn = document.querySelector('.place-order-btn');
        const warningMessage = document.getElementById('orderWarningMessage');
        
        // Check if at least one product is properly selected
        let hasValidProduct = false;
        let hasSize = false;
        let hasHijab = false;
        let hasSelectedProduct = false;
        
        productItems.forEach(item => {
            if (item.classList.contains('selected')) {
                hasSelectedProduct = true;
                const selectedSize = item.querySelector('.size-btn.selected');
                const selectedHijab = item.querySelector('input[type="radio"]:checked');
                if (selectedSize) hasSize = true;
                if (selectedHijab) hasHijab = true;
                if (selectedSize && selectedHijab) {
                    hasValidProduct = true;
                }
            }
        });

        // Check if form fields are filled
        const isNameFilled = nameInput.value.trim() !== '';
        const isAddressFilled = addressInput.value.trim() !== '';
        const isPhoneFilled = phoneInput.value.trim() !== '';
        const isFormFilled = isNameFilled && isAddressFilled && isPhoneFilled;

        // Create warning message based on missing requirements
        let warningText = '';
        if (!hasSelectedProduct) {
            warningText = 'অনুগ্রহ করে একটি পণ্য সিলেক্ট করুন';
        } else if (!hasSize) {
            warningText = 'অনুগ্রহ করে সাইজ নির্বাচন করুন';
        } else if (!hasHijab) {
            warningText = 'অনুগ্রহ করে হিজাব অপশন নির্বাচন করুন';
        } else if (!isFormFilled) {
            const missingFields = [];
            if (!isNameFilled) missingFields.push('নাম');
            if (!isAddressFilled) missingFields.push('ঠিকানা');
            if (!isPhoneFilled) missingFields.push('ফোন নম্বর');
            warningText = `অনুগ্রহ করে ${missingFields.join(', ')} পূরণ করুন`;
        }

        // Update warning message
        if (warningText && !hasValidProduct || !isFormFilled) {
            warningMessage.textContent = warningText;
            warningMessage.classList.add('show');
        } else {
            warningMessage.textContent = '';
            warningMessage.classList.remove('show');
        }

        // Enable/disable submit button based on validation
        if (hasValidProduct && isFormFilled) {
            placeOrderBtn.disabled = false;
            placeOrderBtn.style.opacity = '1';
            placeOrderBtn.style.cursor = 'pointer';
        } else {
            placeOrderBtn.disabled = true;
            placeOrderBtn.style.opacity = '0.5';
            placeOrderBtn.style.cursor = 'not-allowed';
        }

        if (hasValidProduct && isFormFilled) {
            const selectedProducts = getSelectedProducts();
            const totalValue = selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
            
            // Track InitiateCheckout with complete information
            trackFBEvent('InitiateCheckout', {
                value: totalValue,
                contents: selectedProducts.map(p => ({
                    id: p.name,
                    quantity: p.quantity,
                    item_price: p.price
                })),
                content_type: 'product',
                num_items: selectedProducts.reduce((sum, p) => sum + p.quantity, 0)
            }, 'form-validation'); // Add unique identifier
        }

        return { hasValidProduct, isFormFilled };
    }

    function scrollToFormWithValidation(message) {
        // Show validation message
        const validationMessage = document.getElementById('validationMessage');
        validationMessage.textContent = message;
        validationMessage.classList.add('show');

        // Scroll to order form
        const orderForm = document.querySelector('.order-form');
        setTimeout(() => {
            orderForm.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);

        // Highlight empty fields
        const formInputs = document.querySelectorAll('input[type="text"], input[type="tel"], textarea');
        formInputs.forEach(input => {
            if (!input.value.trim()) {
                input.parentElement.classList.add('error');
                // Remove error class when user starts typing
                input.addEventListener('input', function() {
                    this.parentElement.classList.remove('error');
                }, { once: true });
            }
        });
    }

    // Form submission
    orderForm.addEventListener('submit', function(e) {
        e.preventDefault();
        hideProductWarning();
        hideValidationMessage();

        const { hasValidProduct, isFormFilled } = validateForm();
        
        if (!hasValidProduct) {
            showProductWarning('অনুগ্রহ করে কমপক্ষে একটি পণ্য সিলেক্ট করুন এবং সাইজ ও হিজাব অপশন নির্বাচন করুন');
            document.getElementById('product-selection').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center'
            });
            return;
        }

        if (!isFormFilled) {
            scrollToFormWithValidation('অনুগ্রহ করে সকল তথ্য পূরণ করুন');
            return;
        }

        // Show thank you popup immediately
        const popup = document.getElementById('thankYouPopup');
        popup.classList.add('show');
        
        // Play celebration sound
        const celebrationSound = document.getElementById('celebrationSound');
        if (celebrationSound) {
            celebrationSound.currentTime = 0;
            celebrationSound.play().catch(() => {});
        }
        
        // Start confetti animation
        const duration = 2000; // Reduced from 3000 to 2000
        const animationEnd = Date.now() + duration;
        
        (function frame() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return;

            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#4CAF50', '#45a049', '#66BB6A']
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#4CAF50', '#45a049', '#66BB6A']
            });

            requestAnimationFrame(frame);
        }());

        // Add final confetti burst
        setTimeout(() => {
            confetti({
                particleCount: 50, // Reduced from 100 to 50
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#4CAF50', '#45a049', '#66BB6A', '#81C784']
            });
            const popSound = document.getElementById('popSound');
            if (popSound) {
                popSound.currentTime = 0;
                popSound.play().catch(() => {});
            }
        }, 300); // Reduced from 500 to 300

        // Prepare data for Google Sheets
        const name = document.querySelector('input[type="text"]').value;
        const address = document.querySelector('textarea').value;
        const phone = document.querySelector('input[type="tel"]').value;
        const shippingOption = document.querySelector('input[name="shipping"]:checked').value;
        const deliveryCharge = shippingOption === 'dhaka' ? 80 : 150;
        
        // Get selected products information
        let productsInfo = [];
        let totalBill = 0;
        
        productItems.forEach((item) => {
            if (item.classList.contains('selected')) {
                const productName = item.querySelector('h4').textContent;
                const size = item.querySelector('.size-btn.selected')?.textContent || '';
                const hijab = item.querySelector('input[type="radio"]:checked')?.value === 'with' ? 'হিজাবসহ' : 'হিজাব ছাড়া';
                const quantity = item.querySelector('.quantity').value;
                const price = parseInt(item.querySelector('.price').textContent.replace('৳', '').trim());
                
                productsInfo.push(`${productName} (${size}) ${hijab} - ${quantity}টি`);
                totalBill += price * quantity;
            }
        });

        totalBill += deliveryCharge;

        // Prepare data for Google Sheets
        const sheetData = {
            website: 'P-750', // Unique identifier for this website
            timestamp: new Date().toLocaleString('en-US', { 
                timeZone: 'Asia/Dhaka',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).replace(',', ', '),
            name: name,
            phone: phone,
            delivery: shippingOption === 'dhaka' ? 'ঢাকা সিটি' : 'ঢাকার বাইরে',
            address: address,
            total: totalBill,
            products: productsInfo.join('\n') // Each product on a new line
        };

        // Send data to Google Sheet
        fetch('https://script.google.com/macros/s/AKfycby89jr_iSXjDB_vvUNAYlFUWyz1TubeidNtip1uujPqWa3qEk1kV_CkFSWmuUxjovXz/exec', {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(sheetData)
        }).catch(console.error);

        const selectedProducts = getSelectedProducts();
        const totalValue = selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0) + 
                          (document.querySelector('input[value="dhaka"]').checked ? SHIPPING_DHAKA : SHIPPING_OUTSIDE);

        // Track Purchase with complete information
        trackFBEvent('Purchase', {
            value: totalValue,
            contents: selectedProducts.map(p => ({
                id: p.name,
                quantity: p.quantity,
                item_price: p.price
            })),
            content_type: 'product',
            num_items: selectedProducts.reduce((sum, p) => sum + p.quantity, 0)
        }, 'order-submit'); // Add unique identifier

        popup.classList.add('show');
    });

    // Close thank you popup
    window.closeThankYouPopup = function() {
        const popup = document.getElementById('thankYouPopup');
        popup.classList.remove('show');
        
        // Refresh the entire page
        window.location.reload();
    };

    // Add click handler for place order button
    const placeOrderBtn = document.querySelector('.place-order-btn');
    placeOrderBtn.addEventListener('click', function(e) {
        const { hasValidProduct, isFormFilled } = validateForm();
        
        // If no product is selected, scroll to product section
        if (!hasValidProduct) {
            e.preventDefault();
            showProductWarning('অনুগ্রহ করে কমপক্ষে একটি পণ্য সিলেক্ট করুন এবং সাইজ ও হিজাব অপশন নির্বাচন করুন');
            document.getElementById('product-selection').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center'
            });
            return;
        }

        // If product is selected but form not filled, scroll to form
        if (!isFormFilled) {
            e.preventDefault();
            scrollToFormWithValidation('অনুগ্রহ করে সকল তথ্য পূরণ করুন');
            return;
        }
    });

    // Add event listeners for product selections to hide warnings
    document.querySelectorAll('.size-btn, .hijab-option input[type="radio"]').forEach(element => {
        element.addEventListener('change', hideProductWarning);
        element.addEventListener('click', hideProductWarning);
    });

    // Add event listeners for form fields to hide warnings
    const allFormInputs = document.querySelectorAll('input[type="text"], input[type="tel"], textarea');
    allFormInputs.forEach(input => {
        input.addEventListener('input', hideValidationMessage);
    });

    // Existing countdown and scroll functions
    function scrollToProducts(productIndex) {
        const productSection = document.querySelector('.product-selection');
        productSection.scrollIntoView({ behavior: 'smooth' });
        
        setTimeout(() => {
            const products = document.querySelectorAll('.product-item');
            if (products[productIndex]) {
                products.forEach(p => p.classList.remove('selected'));
                products[productIndex].classList.add('selected');
            }
        }, 800);
    }

    function updateCountdown() {
        const hoursElement = document.getElementById('hours');
        const minutesElement = document.getElementById('minutes');
        const secondsElement = document.getElementById('seconds');
        
        let hours = parseInt(hoursElement.textContent);
        let minutes = parseInt(minutesElement.textContent);
        let seconds = parseInt(secondsElement.textContent);
        
        if (seconds > 0) {
            seconds--;
        } else {
            seconds = 59;
            if (minutes > 0) {
                minutes--;
            } else {
                minutes = 59;
                if (hours > 0) {
                    hours--;
                } else {
                    hours = 10;
                    minutes = 32;
                    seconds = 8;
                }
            }
        }
        
        hoursElement.textContent = hours.toString().padStart(2, '0');
        minutesElement.textContent = minutes.toString().padStart(2, '0');
        secondsElement.textContent = seconds.toString().padStart(2, '0');
    }

    setInterval(updateCountdown, 1000);

    // Add event listeners for form inputs and product selections
    allFormInputs.forEach(input => {
        input.addEventListener('input', validateForm);
    });

    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', validateForm);
    });

    document.querySelectorAll('.hijab-option input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', validateForm);
    });

    // Initial validation
    validateForm();

    // Add function to get Facebook Login ID
    async function getFacebookLoginId() {
        try {
            // Try to get Facebook Login ID from cookie or localStorage
            const fbLoginId = localStorage.getItem('fb_login_id') || getCookie('fb_login_id');
            if (fbLoginId) return fbLoginId;

            // If not found, try to get it from Facebook API
            if (typeof FB !== 'undefined' && FB.getLoginStatus) {
                const response = await new Promise((resolve) => {
                    FB.getLoginStatus(function(response) {
                        resolve(response);
                    });
                });
                
                if (response.status === 'connected') {
                    const loginId = response.authResponse.userID;
                    // Store for future use
                    localStorage.setItem('fb_login_id', loginId);
                    return loginId;
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting Facebook Login ID:', error);
            return null;
        }
    }
});