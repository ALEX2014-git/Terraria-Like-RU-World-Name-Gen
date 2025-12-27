class UnifiedRandom {
    constructor(seed) {
        this.MBIG = 2147483647;
        this.MSEED = 161803398;
        this.SeedArray = new Array(56).fill(0);
        this.inext = 0;
        this.inextp = 0;

        if (seed === undefined) {
            seed = Date.now();
        }
        this.SetSeed(seed);
    }

    SetSeed(seed) {
        // 1. Принудительный Clamp входного сида
        let ii = seed | 0; 
        let num = (ii === -2147483648) ? 2147483647 : Math.abs(ii);

        // ВАЖНО: Результат вычитания тоже нужно ограничивать | 0
        let num2 = (this.MSEED - num) | 0;
        this.SeedArray[55] = num2;
        let num3 = 1;
        
        for (let j = 1; j < 55; j++) {
            let num4 = (21 * j) % 55;
            this.SeedArray[num4] = num3;
            
            // ВАЖНО: Эмуляция переполнения C# при вычитании
            num3 = (num2 - num3) | 0; 
            
            if (num3 < 0) {
                num3 += this.MBIG;
            }
            num2 = this.SeedArray[num4];
        }
        
        for (let k = 1; k < 5; k++) {
            for (let l = 1; l < 56; l++) {
                let index = 1 + (l + 30) % 55;
                
                // ВАЖНО: И здесь тоже | 0
                let val = (this.SeedArray[l] - this.SeedArray[index]) | 0;
                
                if (val < 0) {
                    val += this.MBIG;
                }
                this.SeedArray[l] = val;
            }
        }
        
        this.inext = 0;
        this.inextp = 21;
    }
	
	InternalSample()
	{
        // Локальные переменные для скорости
        let num = this.inext;
        let num2 = this.inextp;
        
        if (++num >= 56) num = 1;
        if (++num2 >= 56) num2 = 1;
        
        // ВАЖНО: Самое главное место. Вычитание должно быть 32-битным.
        let num3 = (this.SeedArray[num] - this.SeedArray[num2]) | 0;
        
        // Логика C#: если получилось ровно int.MaxValue, уменьшаем
        if (num3 === 2147483647) {
            num3--;
        }
        // Если ушли в минус (с учетом переполнения выше), корректируем
        if (num3 < 0) {
            num3 += 2147483647;
        }
        
        this.SeedArray[num] = num3;
        this.inext = num;
        this.inextp = num2;
        
        return num3;		
	}
	
	Sample()
	{
		return this.InternalSample() * 4.6566128752457969E-10; 
	}
	
	Next(maxValue) {
		// Эмуляция поведения C#: аргумент должен быть int.
		// Если передадите "10.5", это превратит его в 10.
		maxValue = maxValue | 0;

		if (maxValue < 0) {
			throw new Error("maxValue must be positive.");
		}
		
		// Формула: (int)(Sample() * maxValue)
		// Math.floor округляет вниз, что эквивалентно приведению к int в C# для положительных чисел.
		return Math.floor(this.Sample() * maxValue);
	}	
}

// --- Логика сайта ---

const WorldNameCategory = {
	Compositions: "compositions",
	Adjectives: "adjectives",
	Locations: "locations",
	Nouns: "nouns"
};

/**
 * Выбирает случайное значение из категории, следуя логике Terraria.
 * @param {string} categoryKey - Ключ из WORLD_NAME_DATA (используйте WorldNameCategory).
 * @param {UnifiedRandom} rng - Экземпляр вашего генератора.
 * @returns {string} - Найденное значение или пустая строка.
 */
function SelectRandom(categoryKey, rng = new UnifiedRandom()) {
    // Получаем нужный словарь (объект) по ключу
    const data = WORLD_NAME_DATA[categoryKey];
    
    // Если категории нет или она пуста — возвращаем, как LocalizedText.Empty
    if (!data) return "";

    // --- ПРОХОД 1: Подсчет кандидатов ---
    let num = 0;
    // Используем for...in, чтобы не создавать массив ключей (экономия памяти, как в C#)
    for (let key in data) {
        if (Object.hasOwn(data, key)) { // Аналог проверки filter
            num++;
        }
    }

    // Если ничего не нашли
    if (num === 0) return "";

    // Генерируем случайный индекс от 0 до num
    // (random ?? Main.rand).Next(num)
    let num2 = rng.Next(num);

    // --- ПРОХОД 2: Поиск победителя ---
    // Снова идем по тому же объекту
    for (let key in data) {
        if (Object.hasOwn(data, key)) {
            // Логика C#: if (filter(...) && --num == num2)
            // Сначала уменьшаем num, потом сравниваем.
            // Это выбирает элемент, "двигаясь с конца" относительно сгенерированного индекса.
            if (--num === num2) {
                return data[key]; // Возвращаем Value
            }
        }
    }
    return "";
}

function generateResults() {
    const genAmountCheck = document.getElementById('genAmount');
    const outputContainer = document.getElementById('output');
    
    let genAmount = parseInt(genAmountCheck.value);
    if (isNaN(genAmount) || genAmount <= 0) {
        genAmount = 1;
    }

    let isShowAll = document.getElementById('showAllResults');
    if (!isShowAll.checked && genAmount > 10000) {
        genAmount = 10000;
    }

    const removeLengthLimitCheck = document.getElementById('disableNameLengthLimit');
    let isDisableNameLengthLimit = removeLengthLimitCheck.checked;

	let amountOfConstants = 0;

    outputContainer.innerHTML = 'Генерация...';

    setTimeout(() => {
        const rng = new UnifiedRandom();
        
        const allGeneratedNames = []; 
        const resultsFragment = document.createDocumentFragment();

        for (let i = 0; i < genAmount; i++) {
            let worldName = '';
            
            do {
                let template = SelectRandom(WorldNameCategory.Compositions, rng);

                if (template.includes("{Adjective}")) {
                    template = template.replace("{Adjective}", SelectRandom(WorldNameCategory.Adjectives, rng));
                }
                if (template.includes("{Location}")) {
                    template = template.replace("{Location}", SelectRandom(WorldNameCategory.Locations, rng));
                }
                if (template.includes("{Noun}")) {
                    template = template.replace("{Noun}", SelectRandom(WorldNameCategory.Nouns, rng));
                }
                            
                worldName = template;
                            
                if (rng.Next(10000) == 0) {
                    worldName = WORLD_NAME_DATA["special"]["TheConstant"];
					amountOfConstants++;
                }
            }
            while (worldName.length > 27 && !isDisableNameLengthLimit);          

            allGeneratedNames.push(worldName);

            const div = document.createElement('div');
            div.className = 'result-item';

            const textSpan = document.createElement('span');
            textSpan.textContent = `Генерация #${i + 1}: ${worldName}`;
            
            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'Копировать';
            copyBtn.className = 'copy-btn';
            
            copyBtn.onclick = function() {
                navigator.clipboard.writeText(worldName).then(() => {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Скопировано!';
                    copyBtn.classList.add('success');
                    
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.classList.remove('success');
                    }, 1000);
                }).catch(err => {
                    console.error('Ошибка копирования: ', err);
                });
            };

            div.appendChild(textSpan);
            div.appendChild(copyBtn);
            resultsFragment.appendChild(div);
        }
                
        outputContainer.innerHTML = '';
		
		const constantsDisplay = document.createElement('span');
		
		let numberColor = '#000000';
		if (amountOfConstants == 0)
		{
				numberColor = '#ff4444';
		}
		
		constantsDisplay.innerHTML = `Количество Констант в выыдаче: <span style="color: ${numberColor}; font-weight: bold;">${amountOfConstants}</span>`;
		constantsDisplay.style.display = 'block';
		constantsDisplay.style.padding = '10px';
			
		outputContainer.appendChild(constantsDisplay);
				
        if (genAmount > 1) {           
            const copyAllBtn = document.createElement('button');
            copyAllBtn.textContent = 'Копировать ⚡ ВСЁ ⚡';
            copyAllBtn.className = 'copy-btn copy-all-btn';
			copyAllBtn.style.marginBottom = '15px';
            
            copyAllBtn.onclick = function() {
                const fullText = allGeneratedNames.join('\n');

                navigator.clipboard.writeText(fullText).then(() => {
                    const originalText = copyAllBtn.textContent;
                    copyAllBtn.textContent = '⚡ ВСЁ ⚡ скопировано!';
                    copyAllBtn.classList.add('success');
                    
                    setTimeout(() => {
                        copyAllBtn.textContent = originalText;
                        copyAllBtn.classList.remove('success');
                    }, 2000);
                }).catch(err => {
                    console.error('Ошибка копирования: ', err);
                });
            };          

            outputContainer.appendChild(copyAllBtn);
        }
        
        outputContainer.appendChild(resultsFragment);
    }, 10);
}