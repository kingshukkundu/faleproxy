// Debounce function to limit how often a function is called
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const loadingElement = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const resultContainer = document.getElementById('result-container');
    const contentDisplay = document.getElementById('content-display');
    const originalUrlElement = document.getElementById('original-url');
    const pageTitleElement = document.getElementById('page-title');

    urlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let url = urlInput.value.trim();
        
        if (!url) {
            showError('Please enter a valid URL');
            return;
        }
        
        // Basic validation - ensure there's at least a domain name
        if (!url.includes('.')) {
            showError('Please enter a valid domain name');
            return;
        }
        
        // Automatically add https:// if protocol is missing
        if (!url.match(/^https?:\/\//i)) {
            url = 'https://' + url;
            urlInput.value = url; // Update the input field with the corrected URL
        }
        
        // Show loading indicator
        loadingElement.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        errorMessage.classList.add('hidden');
        
        try {
            const response = await fetch('/fetch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch content');
            }
            
            // Update the info bar
            originalUrlElement.textContent = url;
            originalUrlElement.href = url;
            pageTitleElement.textContent = data.title || 'No title';
            
            // Create a sandboxed iframe to display the content
            const iframe = document.createElement('iframe');
            iframe.sandbox = 'allow-same-origin allow-scripts allow-popups allow-forms';
            iframe.setAttribute('referrerpolicy', 'no-referrer');
            iframe.style.width = '100%';
            iframe.style.border = 'none';
            iframe.style.overflow = 'auto';
            contentDisplay.innerHTML = '';
            contentDisplay.appendChild(iframe);
            
            // Write the sanitized HTML to the iframe
            const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
            iframeDocument.open();
            
            // Sanitize the HTML content before writing to the iframe
            const sanitizedContent = DOMPurify.sanitize(data.content, {
                ADD_TAGS: ['iframe', 'base', 'style', 'link', 'meta'], // Allow these tags for styling and functionality
                ADD_ATTR: ['sandbox', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'rel', 'href', 'type', 'media', 'integrity', 'crossorigin', 'id', 'class'], // Allow attributes needed for styling
                FORCE_BODY: true, // Ensure there's always a body element
                WHOLE_DOCUMENT: true, // Process the entire document including <!DOCTYPE> and <html>
                RETURN_DOM_FRAGMENT: false, // Return HTML as a string
                RETURN_DOM: false,
                USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true }, // Enable all HTML profiles
                KEEP_CONTENT: true // Keep content of elements removed
            });
            
            iframeDocument.write(sanitizedContent);
            iframeDocument.close();
            
            // Variables to control height adjustment
            let heightAdjustmentCount = 0;
            const MAX_HEIGHT_ADJUSTMENTS = 10;
            const MAX_IFRAME_HEIGHT = 10000; // Maximum height in pixels
            
            // Function to adjust iframe height with limitations
            const adjustIframeHeight = () => {
                // Limit the number of height adjustments
                if (heightAdjustmentCount >= MAX_HEIGHT_ADJUSTMENTS) {
                    console.log('Maximum height adjustments reached');
                    return;
                }
                
                heightAdjustmentCount++;
                
                try {
                    let height = iframeDocument.documentElement.scrollHeight || 
                                iframeDocument.body.scrollHeight || 800;
                    
                    // Enforce maximum height
                    height = Math.min(height, MAX_IFRAME_HEIGHT);
                    
                    iframe.style.height = `${height}px`;
                } catch (e) {
                    console.error('Error adjusting iframe height:', e);
                    iframe.style.height = '800px';
                }
            };
            
            // Create debounced version of the height adjustment function
            const debouncedAdjustHeight = debounce(adjustIframeHeight, 200);
            
            // Adjust iframe height on load and when content changes
            iframe.onload = function() {
                // Make sure links open in a new tab
                try {
                    const links = iframeDocument.querySelectorAll('a');
                    links.forEach(link => {
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    });
                    
                    // Add listener for images loading to readjust height
                    const images = iframeDocument.querySelectorAll('img');
                    images.forEach(img => {
                        if (img.complete) {
                            debouncedAdjustHeight();
                        } else {
                            img.addEventListener('load', debouncedAdjustHeight);
                            img.addEventListener('error', debouncedAdjustHeight);
                        }
                    });
                    
                    // Add resize observer to handle dynamic content with debouncing
                    if (window.ResizeObserver) {
                        const resizeObserver = new ResizeObserver(() => {
                            debouncedAdjustHeight();
                        });
                        resizeObserver.observe(iframeDocument.body);
                        
                        // Disconnect observer after a certain time to prevent infinite loops
                        setTimeout(() => {
                            console.log('Disconnecting ResizeObserver to prevent infinite adjustments');
                            resizeObserver.disconnect();
                        }, 10000); // Disconnect after 10 seconds
                    }
                    
                    // Initial height adjustment
                    adjustIframeHeight();
                    
                    // Final height adjustment for late-loading content
                    setTimeout(() => {
                        adjustIframeHeight();
                        // Reset counter to allow manual adjustments later if needed
                        heightAdjustmentCount = 0;
                    }, 2000);
                } catch (e) {
                    console.error('Error in iframe onload:', e);
                }
            };
            
            // Show result container
            resultContainer.classList.remove('hidden');
        } catch (error) {
            showError(error.message);
        } finally {
            // Hide loading indicator
            loadingElement.classList.add('hidden');
        }
    });
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
});
