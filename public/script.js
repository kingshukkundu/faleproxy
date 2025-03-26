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
            iframe.sandbox = 'allow-same-origin allow-scripts allow-popups';
            iframe.style.width = '100%';
            iframe.style.border = 'none';
            iframe.style.overflow = 'auto';
            contentDisplay.innerHTML = '';
            contentDisplay.appendChild(iframe);
            
            // Write the modified HTML to the iframe
            const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
            iframeDocument.open();
            iframeDocument.write(data.content);
            iframeDocument.close();
            
            // Function to adjust iframe height
            const adjustIframeHeight = () => {
                try {
                    const height = iframeDocument.documentElement.scrollHeight || 
                                  iframeDocument.body.scrollHeight || 800;
                    iframe.style.height = `${height}px`;
                } catch (e) {
                    console.error('Error adjusting iframe height:', e);
                    iframe.style.height = '800px';
                }
            };
            
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
                            adjustIframeHeight();
                        } else {
                            img.addEventListener('load', adjustIframeHeight);
                            img.addEventListener('error', adjustIframeHeight);
                        }
                    });
                    
                    // Add resize observer to handle dynamic content
                    if (window.ResizeObserver) {
                        const resizeObserver = new ResizeObserver(() => {
                            adjustIframeHeight();
                        });
                        resizeObserver.observe(iframeDocument.body);
                    }
                    
                    // Initial height adjustment
                    adjustIframeHeight();
                    
                    // Set a timer to readjust height after a delay (for late-loading content)
                    setTimeout(adjustIframeHeight, 1000);
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
