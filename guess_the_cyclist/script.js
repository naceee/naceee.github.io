
function getRandomElement(list) {
    if (!Array.isArray(list) || list.length === 0) {
        throw new Error("Input must be a non-empty array.");
    }
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
}

function getRandomCyclist(difficulty) {
    console.log(difficulty)
    let newCyclist = ""
    if (difficulty === "easy") {
        newCyclist = getRandomElement([
            "Tadej Pogačar", "Remco Evenepoel", "Jasper Philipsen", "Jonas Vingegaard", "Biniam Girmay",
            "Mathieu Van Der Poel", "Primož Roglič", "Matteo Jorgenson", "Jonathan Milan", "Tim Merlier",
            "Ben O'Connor", "João Almeida", "Adam Yates", "Wout Van Aert", "Carlos Rodríguez",
            "Enric Mas", "Mads Pedersen", "Maxim Van Gils", "Juan Ayuso", "Mattias Skjelmose",
            "Oscar Onley", "Brandon McNulty", "Tim Wellens", "Mikel Landa", "Diego Ulissi",
            "Richard Carapaz", "Santiago Buitrago", "Aleksandr Vlasov", "Olav Kooij", "Pello Bilbao",
            "Stefan Küng", "Pavel Sivakov", "David Gaudu", "Antonio Tiberi", "Romain Grégoire",
        ])
    } else if (difficulty === "medium") {
        newCyclist = getRandomElement([
            "Romain Bardet", "Benoît Cosnefroy", "Lenny Martinez", "Jhonatan Narváez", "Toms Skujiņš",
            "Giulio Ciccone", "Axel Zingle", "Alex Aranburu", "Michael Matthews", "Christophe Laporte",
            "Mathias Vacek", "Magnus Sheffield", "Alberto Bettiol", "Dylan Groenewegen", "Valentin Madouas",
            "Egan Bernal", "Jordi Meeus", "Kaden Groves", "Kévin Vauquelin", "Filippo Ganna",
            "Matej Mohorič", "Florian Lipowitz", "Jan Christen", "Marijn Van Den Berg", "Isaac Del Toro",
            "Wilco Kelderman", "António Morgado", "Guillaume Martin", "Aaron Gate", "Mauro Schmid",
            "Thibau Nys", "Nils Politt", "Neilson Powless", "Paul Lapeira", "Finn Fisher-Black",
            "Roger Adrià", "Milan Fretin", "Lorenzo Fortunato", "Alex Baudin", "Luca Mozzato",
            "Orluis Aular", "Javier Romo", "Felix Gall", "Kevin Vermaerke", "Clément Champoussin",
            "Thymen Arensman", "Jai Hindley", "Sam Bennett", "Daniel Felipe Martínez", "Jefferson Alveiro Cepeda",
            "Tiesj Benoot", "Christian Scaroni", "Dorian Godon", "Laurens De Plus", "Max Poole",
            "Valentin Paret-Peintre", "Edoardo Zambanini", "Jasper Stuyven", "Jay Vine", "Pablo Castrillo",
            "Tobias Lund Andresen", "Marc Soler", "Danny Van Poppel", "Henok Mulubrhan", "Laurence Pithie",
            "Filippo Zana", "Vincenzo Albanese", "Ilan Van Wilder", "Maximilian Schachmann", "Wout Poels",
            "Phil Bauhaus", "Joshua Tarling", "Gerben Thijssen", "Simon Yates", "Aurélien Paret-Peintre",
            "Clément Berthet", "Ben Healy", "Jenthe Biermans", "Jelte Krijnsen", "Dylan Teuns",
            "Geraint Thomas", "Ion Izagirre", "Mike Teunissen", "Mauri Vansevenant", "Clément Venturini",
            "Einer Rubio", "Axel Laurance", "Pavel Bittner", "Paul Penhoët", "Frank Van Den Broek",
            "Giovanni Aleotti", "Jan Tratnik", "Paul Magnier", "Giulio Pellizzari", "Luke Plapp",
            "Quinten Hermans", "Max Kanter", "Oliver Naesen", "Bryan Coquard", "Quentin Pacher",
            "Anders Foldager", "Gianni Vermeersch", "Sepp Kuss", "Attila Valter", "Eddie Dunbar",
            "Mikkel Bjerg", "Per Strand Hagenes", "Archie Ryan", "Cristián Rodríguez", "Stefan Bissegger",
            "Bauke Mollema", "Laurenz Rex", "Andrea Vendrame", "Stanisław Aniołkowski", "Edoardo Affini",
            "Filippo Baroncini", "Luke Lamperti", "Oier Lazkano", "Iván Romeo", "Fernando Gaviria",
            "Madis Mihkels", "Lorenzo Rota", "Davide De Pretto", "Max Walscheid", "Chris Harper",
            "Casper Van Uden", "Felix Großschartner", "Simone Velasco", "Fred Wright", "Victor Campenaerts",
            "Xandro Meurisse", "Georg Steinhauser", "Patrick Konrad", "Arnaud Démare", "Sam Welsford",
            "Lukas Nerurkar", "Matteo Malucelli", "Carlos Canal", "Sergio Higuita", "Juan Sebastián Molano",
            "Harold Tejada", "HIRSCHI Marc", "DE LIE Arnaud", "PIDCOCK Thomas", "KRISTOFF Alexander",
            "STRONG Corbin", "CORT Magnus", "JEANNIÈRE Emilien", "ALAPHILIPPE Julian", "VAN EETVELT Lennert",
            "WÆRENSKJOLD Søren", "ABRAHAMSEN Jonas", "GEE Derek"
        ])
    } else {
        newCyclist = getRandomElement([
            "WATSON Samuel", "COSTIOU Ewen", "LEMMEN Bart", "MAJKA Rafał", "GAUTHERAT Pierre", "MOLARD Rudy",
            "ASGREEN Kasper", "DOUBLE Paul", "DEWULF Stan", "CONSONNI Simone", "ZIMMERMANN Georg",
            "WANDAHL Frederik", "MEINTJES Louis", "RIVERA Brandon Smith", "FOSS Tobias", "SÁNCHEZ Pelayo",
            "DEHAIRS Simon", "TURNER Ben", "LECERF Junior", "KIRSCH Alex", "UIJTDEBROEKS Cian", "LÓPEZ Juan Pedro",
            "LAFAY Victor", "SIMMONS Quinn", "BUSATTO Francesco", "CAPIOT Amaury", "BARRENETXEA Jon",
            "JAKOBSEN Fabio", "VALGREN Michael", "PAGE Hugo", "TRONCHON Bastien", "RODRÍGUEZ Óscar",
            "KRAGH ANDERSEN Søren", "OLIVEIRA Nelson", "BARGUIL Warren", "TEUTENBERG Tim Torn", "PRODHOMME Nicolas",
            "GARCÍA CORTINA Iván", "ARMIRAIL Bruno", "HONORÉ Mikkel Frølich", "QUINTANA Nairo", "BAGIOLI Andrea",
            "VAN BOVEN Luca", "HAIG Jack", "FORMOLO Davide", "VAN GESTEL Dries", "CEPEDA Jefferson Alexander",
            "KWIATKOWSKI Michał", "MÜHLBERGER Gregor", "BRAET Vito", "CATTANEO Mattia", "GARCÍA PIERNA Raúl",
            "OLDANI Stefano", "BARRÉ Louis", "TESFATSION Natnael", "DONNENWIRTH Tom", "KIELICH Timo",
            "GUDMESTAD Tord", "BOUWMAN Koen", "GOVEKAR Matevž", "CHAVES Esteban", "OLIVEIRA Rui", "BONNEU Kamiel",
            "MONIQUET Sylvain", "FEDOROV Yevgeniy", "BERNARD Julien", "EENKHOORN Pascal", "LAMPAERT Yves",
            "RENARD Alexis", "STAUNE-MITTET Johannes", "EWAN Caleb", "HAYTER Ethan", "HERREGODTS Rune",
            "ROCHAS Rémy", "VERONA Carlos", "BOL Cees", "CIMOLAI Davide", "MARIT Arne", "CHARMIG Anthon",
            "HOOLE Daan", "VAN DIJKE Tim", "FLYNN Sean", "SCOTSON Callum", "PLOWRIGHT Jensen", "LANGELLOTTI Victor",
            "LÓPEZ Harold Martín", "HAJEK Alexander", "VAN TRICHT Stan", "BARTA Will", "GEOGHEGAN HART Tao",
            "COSTA Rui", "UHLIG Henri", "DE GENDT Aimé", "GUERREIRO Ruben", "BEHRENS Niklas", "TOUZÉ Damien",
            "EEKHOFF Nils", "BATTISTELLA Samuele", "DE BONDT Dries", "EULÁLIO Afonso", "BRENNAN Matthew",
            "BUCHMANN Emanuel", "DEGENKOLB John", "GUERNALEC Thibault", "ROMELE Alessandro", "SWIFT Ben",
            "GENIETS Kevin", "BALLERINI Davide", "NORDHAGEN Jørgen", "RAFFERTY Darren", "CARUSO Damiano",
            "COVI Alessandro", "ROLLAND Brieuc", "ALLEGAERT Piet", "GLOAG Thomas", "FERRON Valentin",
            "ASKEY Lewis", "VERRE Alessandro", "VANGHELUWE Warre", "VERGALLITO Luca", "CONCI Nicola",
            "THEUNS Edward", "TRÆEN Torstein", "WALKER Max", "ARRIETA Igor", "GRUEL Thibaud", "TONEATTI Davide",
            "ENGELHARDT Felix", "LABROSSE Jordan", "MILESI Lorenzo", "PEDERSEN Rasmus Søjberg", "SWEENY Harry",
            "ISIDORE Noa", "VERVAEKE Louis", "RUSSO Clément", "KEPPLINGER Rainer", "MEZGEC Luka",
            "ARNDT Nikias", "GELDERS Gil", "VAN DIJKE Mick", "LEEMREIZE Gijs", "VAN SINTMAARTENSDIJK Roel",
            "OLIVEIRA Ivo"
        ])
    }

    console.log("cyclist:", newCyclist)
    return newCyclist
}

document.addEventListener("DOMContentLoaded", () => {
    const chatContainer = document.getElementById("chat-container");
    const sendButton = document.getElementById("send-btn");
    const userInput = document.getElementById("user-input");

    const instructions = "You are playing a guessing game. The user will ask you questions about a certain " +
    "cyclist and you should respond truthfully and as short as possible. "

    let chosenCyclist = ""
    let apiKey = ""
    let conversation = []


    chatContainer.innerHTML = `<div class='message bot-message'>Select the difficulty to start playing the game.</div>`;
    chatContainer.scrollTop = chatContainer.scrollHeight;

    let firstGame = true

    // Function to send a message
    async function sendMessage() {
        const message = userInput.value.trim();
        if (message !== "" && chosenCyclist !== "") {
            // Append user message to chat
            const userMessage = document.createElement("div");
            userMessage.classList.add("user-message");
            userMessage.textContent = message;
            chatContainer.innerHTML += `<div class='message user-message'>${message}</div>`;

            // Clear input field
            userInput.value = "";

            // Scroll to the latest message
            chatContainer.scrollTop = chatContainer.scrollHeight;
            conversation.push({"role": "user", "content": message})


            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "chatgpt-4o-latest",
                    messages: conversation
                })
            });


            const data = await response.json();
            const botMessage = data.choices?.[0]?.message?.content || "Error receiving response.";
            chatContainer.innerHTML += `<div class='message bot-message'>${botMessage}</div>`;
            conversation.push({"role": "system", "content": botMessage})
            chatContainer.scrollTop = chatContainer.scrollHeight;

        }
    }

    // Send message when clicking the button
    sendButton.addEventListener("click", sendMessage);

    // Send message when pressing "Enter" in the input field
    userInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault(); // Prevent default behavior (e.g., new lines in a form)
            sendMessage();
        }
    });

    // Clear chat when clicking difficulty buttons
    document.querySelectorAll(".difficulty-btn").forEach(button => {
        button.addEventListener("click", () => {
            apiKey = document.getElementById("api-key").value

            if (firstGame === false) {
                chatContainer.innerHTML = "";
            } else {
                firstGame = false
            }
            chosenCyclist = getRandomCyclist(button.id)
            conversation = [{
                "role": "system",
                "content": `${instructions} Selected cyclist is ${chosenCyclist}. NEVER INCLUDE HIS NAME IN YOUR ANSWERS UNLESS THE USER GIVES UP.`
            }]
            chatContainer.innerHTML += `<div class='message bot-message'>Try to guess the cyclist I picked :)</div>`;

        });
    });
});
