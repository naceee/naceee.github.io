document.addEventListener("DOMContentLoaded", function () {
    const loader = document.getElementById("loader");
    const popup = document.getElementById("popup");

    setTimeout(function () {
        loader.style.animation = "none"; // Stop the spinning animation
        popup.style.display = "block"; // Show the popup
    }, 5000); // 10 seconds (10,000 milliseconds)
});
