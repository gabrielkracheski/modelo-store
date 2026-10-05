/* ====================================================================
   ÍNDICE DO ARQUIVO
   --------------------------------------------------------------------
    1. FIREBASE: imports e inicialização
    2. REFERÊNCIAS: telas e seções
    3. AUTENTICAÇÃO (login / criar conta / sair)
    4. ESTADO + SINCRONIZAÇÃO EM TEMPO REAL (onSnapshot)
    5. NAVEGAÇÃO ENTRE SEÇÕES
    6. REFERÊNCIAS: formulário, paginação, filtros, modal
    7. MODAL (abrir / fechar)
    8. FILTROS
    9. FUNÇÕES AUXILIARES (moeda, data, total)
   10. PAGINAÇÃO
   11. SELEÇÃO EM MASSA (selecionar todos + exclusão)
   12. ENVIO DO FORMULÁRIO (criar / editar)
   13. EDITAR E EXCLUIR (individual)
   14. RENDERIZAÇÃO DA TABELA DE COMPRAS

   Obs.: a ordem do código foi mantida exatamente como no original.
   Em JavaScript, const/let precisam ser declaradas ANTES de serem
   usadas em tempo de execução, então mudar a ordem pode quebrar algo.
   ==================================================================== */


/* ====================================================================
   1. FIREBASE: imports e inicialização
   ==================================================================== */

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Módulo de autenticação (login por e-mail e senha)
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
// Módulo do banco de dados Firestore (CRUD + escuta em tempo real)
import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCIwEb6uMDtHZLwhOhKQcADJlgTsM4CygE",
    authDomain: "modelo-store.firebaseapp.com",
    projectId: "modelo-store",
    storageBucket: "modelo-store.firebasestorage.app",
    messagingSenderId: "312366815849",
    appId: "1:312366815849:web:5aa35554c5df9836b460f8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


/* ====================================================================
   2. REFERÊNCIAS: telas e seções
   ==================================================================== */

//Definição de TELA
const telaLogin = document.getElementById("tela-login");
const telaApp = document.getElementById("tela-app");
const loginErro = document.getElementById("login-erro");

//Definição de SEÇÕES
const secoes = document.querySelectorAll(".secao");
const botoesNav = document.querySelectorAll(".nav-item");


/* ====================================================================
   3. AUTENTICAÇÃO (login / criar conta / sair)
   ==================================================================== */
document.getElementById("botao-entrar").addEventListener("click", function () {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    signInWithEmailAndPassword(auth, email, senha)
        .catch(function (erro) {
            loginErro.textContent = "E-mail ou senha inválidos.";
        });
});

// Permite entrar apertando Enter no campo de senha
document.getElementById("login-senha").addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") {
        document.getElementById("botao-entrar").click();
    }
});

document.getElementById("botao-criar-conta").addEventListener("click", function () {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    createUserWithEmailAndPassword(auth, email, senha)
        .catch(function (erro) {
            loginErro.textContent = erro.message;
        });
});

document.getElementById("botao-sair").addEventListener("click", function () {
    signOut(auth);
});


/* ====================================================================
   4. ESTADO + SINCRONIZAÇÃO EM TEMPO REAL
   ==================================================================== */

//Sincronização
// Estado global da aplicação
let compras = []              // lista de compras (preenchida só pelo onSnapshot)
let pararDeEscutar = null;    // função para "desligar" a escuta ao deslogar
let selecionados = new Set(); // IDs marcados nos checkboxes (fonte da verdade da seleção)
let idsPaginaAtual = [];      // IDs visíveis na página atual (usado pelo "selecionar todos")

//Usuário Logado
const textoUsuarioLogado = document.getElementById("texto-usuario-logado");

// Dispara sempre que o usuário entra ou sai: alterna telas e liga/desliga a escuta
onAuthStateChanged(auth, function (usuario) {
    if (usuario) {
        telaLogin.style.display = "none";
        telaApp.style.display = "block";
        textoUsuarioLogado.textContent = usuario.email;

        // Só busca (e escuta) os documentos que pertencem a este usuário
        const consulta = query(
            collection(db, "compras"),
            where("uid", "==", usuario.uid)
        );

        // onSnapshot = "escuta ao vivo": roda de novo automaticamente
        // toda vez que os dados mudam no Firestore, em qualquer dispositivo
        pararDeEscutar = onSnapshot(consulta, function (snapshot) {
            compras = snapshot.docs.map(function (documento) {
                return { id: documento.id, ...documento.data() };
            });

            renderizar();
            //renderizarResumo();
            //renderizarResumoAnual();
            //preencherSeletorMeses();
            //renderizarDashboard();
        });

    } else {
        telaLogin.style.display = "block";
        telaApp.style.display = "none";

        if (pararDeEscutar) {
            pararDeEscutar(); // evita continuar escutando dados de uma sessão encerrada
        }
        compras = [];
    }
});


/* ====================================================================
   5. NAVEGAÇÃO ENTRE SEÇÕES
   ==================================================================== */

// Controla qual <section> fica visível, com base no data-secao do botão
function mostrarSecao(nomeSecao) {

    secoes.forEach(function (secao) {
        secao.style.display = secao.id === "secao-" + nomeSecao ? "block" : "none";
    });

    botoesNav.forEach(function (botao) {
        botao.classList.toggle("ativo", botao.dataset.secao === nomeSecao);
    });
}

botoesNav.forEach(function (botao) {
    botao.addEventListener("click", function () {
        mostrarSecao(botao.dataset.secao);
    });
});

mostrarSecao("compras"); // mostra a seção de produtos por padrão


/* ====================================================================
   6. REFERÊNCIAS: FORMULÁRIO, PAGINAÇÃO, FILTROS, MODAL, IMPORTAÇÃO
   ==================================================================== */

// Formulário, tabela e modal
const form = document.getElementById("form-lancamento");
const lista = document.getElementById("lista-compras");
const modal = document.getElementById("modal-compra");
const modalTitulo = document.getElementById("modal-titulo");
const botaoNovoLancamento = document.getElementById("botao-novo-compra");
const botaoFecharModal = document.getElementById("botao-fechar-modal");

// Filtros e textos de apoio
const filtroDataInicioPedido = document.getElementById("filtro-data-inicio-pedido");
const filtroDataFimPedido = document.getElementById("filtro-data-fim-pedido");
const filtroEntrega = document.getElementById("filtro-entrega");
const botaoLimparFiltros = document.getElementById("botao-limpar-filtros")
const textoTotalCompras = document.getElementById("texto-total-compras")

// Seleção em massa
const textoSelecionados = document.getElementById("texto-selecionados");
const botaoExcluirSelecionados = document.getElementById("botao-excluir-selecionados");
const selecionarTodos = document.getElementById("selecionar-todos");

// Controle de paginação e edição
let paginaAtual = 1;
let itensPorPagina = 10; // let, não const: muda via seletor de itens por página
let indiceEmEdicao = null; // null = criando um novo; número = editando esse índice
const botaoPaginaAnterior = document.getElementById("botao-pagina-anterior");
const botaoPaginaProxima = document.getElementById("botao-pagina-proxima");
const textoPagina = document.getElementById("texto-pagina");
const seletorItensPorPagina = document.getElementById("itens-por-pagina");


/* ====================================================================
   7. MODAL (abrir / fechar)
   ==================================================================== */

/* ---------- Modal: reaproveitado tanto para criar quanto editar ---------- */
function abrirModal(titulo) {
    modalTitulo.textContent = titulo;
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
    form.reset();
    indiceEmEdicao = null;
    form.querySelector("button[type=submit]").textContent = "Adicionar";
}

botaoNovoLancamento.addEventListener("click", function () {
    abrirModal("Nova Compra", true);
});

botaoFecharModal.addEventListener("click", fecharModal);

// Fecha o modal ao clicar na área escurecida fora do card (mas não ao
// clicar dentro do formulário) — checagem via evento.target === modal
modal.addEventListener("click", function (evento) {
    if (evento.target === modal) {
        fecharModal();
    }
});


/* ====================================================================
   8. FILTROS
   (no original, este bloco vinha sob o título "ENVIO DO FORMULÁRIO";
   o envio do formulário de fato está na seção 12)
   ==================================================================== */
/* ---------- Filtros: cada campo re-renderiza a lista ao mudar,
   sempre voltando para a página 1 (evita ficar "preso" numa página
   que deixou de existir depois de um filtro mais restritivo) ---------- */


filtroDataInicioPedido.addEventListener("change", function () {
    renderizar();
});
filtroDataFimPedido.addEventListener("change", function () {
    renderizar();
});
filtroEntrega.addEventListener("change", function () {
    renderizar();
});

botaoLimparFiltros.addEventListener("click", function () {
    filtroDataInicioPedido.value = "";
    filtroDataFimPedido.value = ""
    filtroEntrega.value = ""
    renderizar()
});


/* ====================================================================
   9. FUNÇÕES AUXILIARES (moeda, data, total)
   ==================================================================== */

// Formata número como moeda brasileira (ex: 1500 -> "R$ 1.500,00")
function formatarMoeda(valor) {
    return "R$ " + valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Só para exibição: converte AAAA-MM-DD em DD-MM-AAAA
function formatarData(dataISO) {
    const [ano, mes, dia] = dataISO.split("-");
    return dia + "-" + mes + "-" + ano;
}

// Total da compra = (preço x quantidade) + frete
function calcularTotal(preco, frete, quantidade) {
    return (preco * quantidade) + frete;
}


/* ====================================================================
   10. PAGINAÇÃO
   ==================================================================== */
botaoPaginaAnterior.addEventListener("click", function () {
    paginaAtual--;
    renderizar();
});

botaoPaginaProxima.addEventListener("click", function () {
    paginaAtual++;
    renderizar();
});

seletorItensPorPagina.addEventListener("change", function () {
    itensPorPagina = parseInt(seletorItensPorPagina.value);
    console.log(itensPorPagina)
    paginaAtual = 1;
    renderizar();
});


/* ====================================================================
   11. SELEÇÃO EM MASSA: "selecionar todos" + exclusão
   ==================================================================== */

// Recalcula o texto "X selecionado(s)", o botão de excluir e o
// checkbox "selecionar todos" a partir do Set "selecionados"
function atualizarBarraSelecao() {
    const quantidade = selecionados.size;
    textoSelecionados.textContent = quantidade > 0 ? quantidade + " selecionado(s)" : "";
    botaoExcluirSelecionados.disabled = quantidade === 0;

    selecionarTodos.checked = idsPaginaAtual.length > 0 &&
        idsPaginaAtual.every(function (id) { return selecionados.has(id); });
}

selecionarTodos.addEventListener("change", function () {
    // Marca/desmarca só os IDs da PÁGINA ATUAL (não todos os filtrados)
    idsPaginaAtual.forEach(function (id) {
        if (selecionarTodos.checked) {
            selecionados.add(id);
        } else {
            selecionados.delete(id);
        }
    });
    renderizar();
});


botaoExcluirSelecionados.addEventListener("click", async function () {
    const confirmar = confirm("Excluir " + selecionados.size + " lançamento(s) selecionado(s)? Esta ação não pode ser desfeita.");
    if (!confirmar) return;

    // for...of funciona em qualquer iterável, incluindo Set (que não
    // tem .forEach com a mesma assinatura simples dos arrays)
    for (const id of selecionados) {
        await deleteDoc(doc(db, "compras", id));
    }

    selecionados.clear();
    renderizar();
    // Não precisa renderizar() manualmente: o onSnapshot detecta as
    // exclusões e atualiza a tela sozinho
});


/* ====================================================================
   12. ENVIO DO FORMULÁRIO (criar / editar)
   ==================================================================== */
form.addEventListener("submit", async function (evento) {
    evento.preventDefault(); // evita o comportamento padrão de recarregar a página

    const preco = parseFloat(document.getElementById("preco").value);
    const frete = parseFloat(document.getElementById("frete").value);
    const quantidade = parseInt(document.getElementById("quantidade").value);
    const dataPedido = document.getElementById("dataPedido").value;

    // Dados comuns a todos os casos (novo, edição, ou cada cópia de uma repetição)
    const dadosBase = {
        uid: auth.currentUser.uid,
        lote: parseInt(document.getElementById("lote").value),
        dataPedido: dataPedido,
        preco: parseFloat(preco),
        frete: parseFloat(frete),
        quantidade: parseInt(quantidade),
        total: calcularTotal(preco, frete, quantidade),
        entrega: document.getElementById("entrega").value,
        dataEntrega: document.getElementById("dataEntrega").value,
    };

    if (indiceEmEdicao === null) {
        await addDoc(collection(db, "compras"), { ...dadosBase, data: dataPedido });
    } else {
        // Editando um lançamento existente: atualiza o documento pelo ID salvo
        const idDocumento = compras[indiceEmEdicao].id;
        await updateDoc(doc(db, "compras", idDocumento), { ...dadosBase, data: dataPedido });
        indiceEmEdicao = null;
        form.querySelector("button[type=submit]").textContent = "Adicionar";
    }


    form.reset();
    fecharModal();
});


/* ====================================================================
   13. EDITAR E EXCLUIR (individual)
   ==================================================================== */

//Renderização COMPRAS
/* ---------- Editar: preenche o formulário com os dados do item clicado ---------- */
function editarLancamento(indice) {
    const item = compras[indice];

    document.getElementById("lote").value = item.lote;
    document.getElementById("dataPedido").value = item.dataPedido;
    document.getElementById("preco").value = item.preco;
    document.getElementById("frete").value = item.frete;
    document.getElementById("quantidade").value = item.quantidade;
    document.getElementById("entrega").value = item.entrega;
    document.getElementById("dataEntrega").value = item.dataEntrega;

    indiceEmEdicao = indice;
    form.querySelector("button[type=submit]").textContent = "Salvar alteração";
    abrirModal("Editar Lançamento", false);
}

/* ---------- Exclusão individual ---------- */
async function excluirLancamento(indice) {
    const confirmar = confirm("Tem certeza que deseja excluir este lançamento?");

    if (!confirmar) return;

    const idDocumento = compras[indice].id;
    await deleteDoc(doc(db, "compras", idDocumento));
    // Não precisa chamar renderizar() aqui: o onSnapshot detecta a
    // exclusão no Firestore e atualiza a tela sozinho
}


/* ====================================================================
   14. RENDERIZAÇÃO DA TABELA DE COMPRAS
   Fluxo: filtra -> ordena -> pagina -> desenha as linhas -> atualiza
   contadores. Chamada sempre que "compras" muda (via onSnapshot) ou
   quando filtro/página/seleção mudam.
   ==================================================================== */
function renderizar() {
    lista.innerHTML = "";

    // --- Valores atuais dos filtros ---
    const dataInicioPedido = filtroDataInicioPedido.value
    const dataFimPedido = filtroDataFimPedido.value
    const entrega = filtroEntrega.value

    // --- Filtra e ordena (mais recente primeiro) ---
    const lancamentosFiltrados = compras.filter(function (item) {
        const passaDataInicioPedido = dataInicioPedido === "" || item.dataPedido >= dataInicioPedido;
        const passaDataFimPedido = dataFimPedido === "" || item.dataPedido <= dataFimPedido;
        const passaEntrega = entrega === "" || item.entrega === entrega;
        return passaDataInicioPedido && passaDataFimPedido && passaEntrega;
    }).sort(function (a, b) {
        return b.dataPedido.localeCompare(a.dataPedido);
    });

    // --- Paginação: calcula o total de páginas e o recorte da página atual ---
    const totalPaginas = Math.max(1, Math.ceil(lancamentosFiltrados.length / itensPorPagina));

    // Evita ficar numa página que deixou de existir (ex: filtro reduziu o total)
    if (paginaAtual > totalPaginas) {
        paginaAtual = totalPaginas;
    }

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const lancamentosDaPagina = lancamentosFiltrados.slice(inicio, fim);

    textoPagina.textContent = "Página " + paginaAtual + " de " + totalPaginas;
    botaoPaginaAnterior.disabled = paginaAtual === 1;
    botaoPaginaProxima.disabled = paginaAtual === totalPaginas;

    // --- Desenha uma linha <tr> para cada item da página ---
    lancamentosDaPagina.forEach(function (item) {
        const linha = document.createElement("tr");

        // Checkbox de seleção: nasce marcado/desmarcado consultando o
        // Set "selecionados" — ele é sempre a fonte da verdade, não o DOM
        const celulaSelecionar = document.createElement("td");
        const checkboxLinha = document.createElement("input");
        checkboxLinha.type = "checkbox";
        checkboxLinha.checked = selecionados.has(item.id);
        checkboxLinha.addEventListener("change", function () {
            if (checkboxLinha.checked) {
                selecionados.add(item.id);
            } else {
                selecionados.delete(item.id);
            }
            atualizarBarraSelecao();
        });
        celulaSelecionar.appendChild(checkboxLinha);

        // Células de dados da compra
        const celulaLote = document.createElement("td");
        celulaLote.textContent = item.lote;

        const celulaDataPedido = document.createElement("td");
        celulaDataPedido.textContent = formatarData(item.dataPedido);

        const celulaPreco = document.createElement("td");
        celulaPreco.textContent = formatarMoeda(item.preco);

        const celulaFrete = document.createElement("td");
        celulaFrete.textContent = formatarMoeda(item.frete);

        const celulaQuantidade = document.createElement("td");
        celulaQuantidade.textContent = item.quantidade;

        const celulaTotal = document.createElement("td");
        celulaTotal.textContent = formatarMoeda(item.total);

        const celulaEntrega = document.createElement("td");
        celulaEntrega.textContent = item.entrega;

        const celulaDataEntrega = document.createElement("td");
        celulaDataEntrega.textContent = item.dataEntrega ? formatarData(item.dataEntrega) : "----------------";

        // Célula de ações: botões Editar e Excluir
        const celulaAcoes = document.createElement("td");
        const botaoEditar = document.createElement("button");
        botaoEditar.textContent = "Editar";
        botaoEditar.addEventListener("click", function () {
            const indiceReal = compras.indexOf(item);
            editarLancamento(indiceReal);
        });

        const botaoExcluir = document.createElement("button");
        botaoExcluir.textContent = "Excluir";
        botaoExcluir.addEventListener("click", function () {
            const indiceReal = compras.indexOf(item);
            excluirLancamento(indiceReal);
        });

        celulaAcoes.appendChild(botaoEditar);
        celulaAcoes.appendChild(botaoExcluir);

        // Monta a linha na ordem das colunas da tabela
        linha.appendChild(celulaSelecionar);
        linha.appendChild(celulaLote);
        linha.appendChild(celulaDataPedido);
        linha.appendChild(celulaPreco);
        linha.appendChild(celulaFrete);
        linha.appendChild(celulaQuantidade);
        linha.appendChild(celulaTotal);
        linha.appendChild(celulaEntrega);
        linha.appendChild(celulaDataEntrega);
        linha.appendChild(celulaAcoes);

        lista.appendChild(linha);
    });

    // --- Atualiza a barra de seleção e o contador de total ---
    // (idsPaginaAtual precisa ser atualizado ANTES de atualizarBarraSelecao)
    idsPaginaAtual = lancamentosDaPagina.map(function (item) { return item.id; });
    atualizarBarraSelecao();
    textoTotalCompras.textContent = "Total: " + lancamentosFiltrados.length + " lançamento(s)";

}