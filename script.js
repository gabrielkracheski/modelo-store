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

let vendas = []              // lista de vendas (preenchida só pelo onSnapshot)
let pararDeEscutarVenda = null;    // função para "desligar" a escuta ao deslogar
let selecionadosVenda = new Set(); // IDs marcados nos checkboxes (fonte da verdade da seleção) 
let idsPaginaAtualVenda = [];      // IDs visíveis na página atual (usado pelo "selecionar todos")

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
        });

        // Vendas
        const consultaVendas = query(
            collection(db, "vendas"),
            where("uid", "==", usuario.uid)
        );

        pararDeEscutarVenda = onSnapshot(consultaVendas, function (snapshot) {
            vendas = snapshot.docs.map(function (documento) {
                return { id: documento.id, ...documento.data() };
            });

            renderizarVendas();

        });

    } else {
        telaLogin.style.display = "block";
        telaApp.style.display = "none";

        if (pararDeEscutar) {
            pararDeEscutar(); // evita continuar escutando dados de uma sessão encerrada
        }
        if (pararDeEscutarVenda) {
            pararDeEscutarVenda();
            pararDeEscutarVenda = null;
        }

        compras = [];
        vendas = [];
        selecionados.clear();
        selecionadosVenda.clear();
        renderizar();
        renderizarVendas();
        loginErro.textContent = "";
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

const botaoNovoVenda = document.getElementById("botao-novo-venda");
const modalVenda = document.getElementById("modal-venda");
const modalTituloVenda = document.getElementById("modal-titulo-venda");
const botaoFecharModalVenda = document.getElementById("botao-fechar-modal-venda");
const formVenda = document.getElementById("form-lancamento-venda");
const listaVendas = document.getElementById("lista-vendas");


// Filtros e textos de apoio
const filtroDataInicioPedido = document.getElementById("filtro-data-inicio-pedido");
const filtroDataFimPedido = document.getElementById("filtro-data-fim-pedido");
const filtroEntrega = document.getElementById("filtro-entrega");
const botaoLimparFiltros = document.getElementById("botao-limpar-filtros")
const textoTotalCompras = document.getElementById("texto-total-compras")

const filtroDataInicioVenda = document.getElementById("filtro-data-inicio-venda");
const filtroDataFimVenda = document.getElementById("filtro-data-fim-venda");
const filtroEntregaVenda = document.getElementById("filtro-entrega-venda");
const filtroTipoVenda = document.getElementById("filtro-tipoVenda")
const botaoLimparFiltrosVenda = document.getElementById("botao-limpar-filtros-venda")
const textoTotalVendas = document.getElementById("texto-total-vendas")
const filtroPagoVenda = document.getElementById("filtro-pago-venda");


// Seleção em massa
const textoSelecionados = document.getElementById("texto-selecionados");
const botaoExcluirSelecionados = document.getElementById("botao-excluir-selecionados");
const selecionarTodos = document.getElementById("selecionar-todos");

const textoSelecionadosVenda = document.getElementById("texto-selecionados-venda");
const botaoExcluirSelecionadosVenda = document.getElementById("botao-excluir-selecionados-venda");
const selecionarTodosVenda = document.getElementById("selecionar-todos-venda");

// Controle de paginação e edição
let paginaAtual = 1;
let itensPorPagina = 10; // let, não const: muda via seletor de itens por página
let indiceEmEdicao = null; // null = criando um novo; número = editando esse índice
const botaoPaginaAnterior = document.getElementById("botao-pagina-anterior");
const botaoPaginaProxima = document.getElementById("botao-pagina-proxima");
const textoPagina = document.getElementById("texto-pagina");
const seletorItensPorPagina = document.getElementById("itens-por-pagina");

let paginaAtualVenda = 1;
let itensPorPaginaVenda = 10;
let indiceEmEdicaoVenda = null;
const botaoPaginaAnteriorVenda = document.getElementById("botao-pagina-anterior-venda");
const botaoPaginaProximaVenda = document.getElementById("botao-pagina-proxima-venda");
const textoPaginaVenda = document.getElementById("texto-pagina-venda");
const seletorItensPorPaginaVenda = document.getElementById("itens-por-pagina-venda");


/* ====================================================================
   7. MODAL (abrir / fechar)
   ==================================================================== */

/* ---------- Modal: reaproveitado tanto para criar quanto editar ---------- */

function proximoLote() {
    if (compras.length === 0) return 1;

    const lotes = compras.map(function (item) {
        return Number(item.lote) || 0;
    });

    return Math.max(...lotes) + 1;
}

function proximoVenda() {
    if (vendas.length === 0) return 1;

    const lotes = vendas.map(function (item) {
        return Number(item.num) || 0;
    });

    return Math.max(...lotes) + 1;
}



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
    document.getElementById("lote").value = proximoLote();
    abrirModal("Nova Compra", true);
});

function abrirModalVenda(titulo) {
    modalTituloVenda.textContent = titulo;
    modalVenda.style.display = "flex";
}

function fecharModalVenda() {
    modalVenda.style.display = "none";
    formVenda.reset();
    indiceEmEdicaoVenda = null;
    formVenda.querySelector("button[type=submit]").textContent = "Adicionar";
}

botaoNovoVenda.addEventListener("click", function () {
    document.getElementById("num").value = proximoVenda();
    abrirModalVenda("Nova Venda", true);
});

botaoFecharModal.addEventListener("click", fecharModal);

botaoFecharModalVenda.addEventListener("click", fecharModalVenda);

// Fecha o modal ao clicar na área escurecida fora do card (mas não ao
// clicar dentro do formulário) — checagem via evento.target === modal
modal.addEventListener("click", function (evento) {
    if (evento.target === modal) {
        fecharModal();
    }
});

modalVenda.addEventListener("click", function (evento) {
    if (evento.target === modalVenda) {
        fecharModalVenda();
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

//Filtros vendas
filtroDataInicioVenda.addEventListener("change", function () {
    renderizarVendas();
});

filtroDataFimVenda.addEventListener("change", function () {
    renderizarVendas();
});

filtroEntregaVenda.addEventListener("change", function () {
    renderizarVendas();
});

filtroTipoVenda.addEventListener("change", function () {
    renderizarVendas();
});

filtroPagoVenda.addEventListener("change", function () {
    renderizarVendas();
});

botaoLimparFiltrosVenda.addEventListener("click", function () {
    filtroDataInicioVenda.value = "";
    filtroDataFimVenda.value = ""
    filtroEntregaVenda.value = ""
    filtroTipoVenda.value = ""
    filtroPagoVenda.value = "";
    renderizarVendas()
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

function calcularTotalVenda(preco, quantidade) {
    return (preco * quantidade);
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
    paginaAtual = 1;
    renderizar();
});

botaoPaginaAnteriorVenda.addEventListener("click", function () {
    paginaAtualVenda--;
    renderizarVendas();
});

botaoPaginaProximaVenda.addEventListener("click", function () {
    paginaAtualVenda++;
    renderizarVendas();
});

seletorItensPorPaginaVenda.addEventListener("change", function () {
    itensPorPaginaVenda = parseInt(seletorItensPorPaginaVenda.value);
    paginaAtualVenda = 1;
    renderizarVendas();
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

function atualizarBarraSelecaoVenda() {
    const quantidade = selecionadosVenda.size;
    textoSelecionadosVenda.textContent = quantidade > 0 ? quantidade + " selecionado(s)" : "";
    botaoExcluirSelecionadosVenda.disabled = quantidade === 0;

    selecionarTodosVenda.checked = idsPaginaAtualVenda.length > 0 &&
        idsPaginaAtualVenda.every(function (id) { return selecionadosVenda.has(id); });
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

selecionarTodosVenda.addEventListener("change", function () {
    // Marca/desmarca só os IDs da PÁGINA ATUAL (não todos os filtrados)
    idsPaginaAtualVenda.forEach(function (id) {
        if (selecionarTodosVenda.checked) {
            selecionadosVenda.add(id);
        } else {
            selecionadosVenda.delete(id);
        }
    });
    renderizarVendas();
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
    atualizarBarraSelecao();
    renderizar();
    // Não precisa renderizar() manualmente: o onSnapshot detecta as
    // exclusões e atualiza a tela sozinho
});

botaoExcluirSelecionadosVenda.addEventListener("click", async function () {
    const confirmar = confirm("Excluir " + selecionadosVenda.size + " lançamento(s) selecionado(s)? Esta ação não pode ser desfeita.");
    if (!confirmar) return;

    // for...of funciona em qualquer iterável, incluindo Set (que não
    // tem .forEach com a mesma assinatura simples dos arrays)
    for (const id of selecionadosVenda) {
        await deleteDoc(doc(db, "vendas", id));
    }

    selecionadosVenda.clear();
    atualizarBarraSelecaoVenda();
    renderizarVendas();
    // Não precisa renderizar() manualmente: o onSnapshot detecta as
    // exclusões e atualiza a tela sozinho
});

/* ====================================================================
   12. ENVIO DO FORMULÁRIO (criar / editar)
   ==================================================================== */
form.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const botaoSubmit = form.querySelector("button[type=submit]");
    if (botaoSubmit.disabled) return;   // trava extra contra duplo clique
    botaoSubmit.disabled = true;

    try {
        const preco = parseFloat(document.getElementById("preco").value);
        const frete = parseFloat(document.getElementById("frete").value);
        const quantidade = parseInt(document.getElementById("quantidade").value);
        const dataPedido = document.getElementById("dataPedido").value;

        const dadosBase = {
            uid: auth.currentUser.uid,
            lote: parseInt(document.getElementById("lote").value),
            dataPedido: dataPedido,
            preco: preco,
            frete: frete,
            quantidade: quantidade,
            total: calcularTotal(preco, frete, quantidade),
            entrega: document.getElementById("entrega").value,
            dataEntrega: document.getElementById("dataEntrega").value,
        };

        if (indiceEmEdicao === null) {
            await addDoc(collection(db, "compras"), { ...dadosBase, data: dataPedido });
        } else {
            const idDocumento = compras[indiceEmEdicao].id;
            await updateDoc(doc(db, "compras", idDocumento), { ...dadosBase, data: dataPedido });
        }

        fecharModal();   // já faz form.reset(), zera o índice e volta o texto do botão
    } catch (erro) {
        console.error(erro);
        alert("Não foi possível salvar. Verifique sua conexão e tente novamente.");
    } finally {
        botaoSubmit.disabled = false;
    }
});

formVenda.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const botaoSubmit = formVenda.querySelector("button[type=submit]");
    if (botaoSubmit.disabled) return;
    botaoSubmit.disabled = true;

    try {
        const num = parseInt(document.getElementById("num").value);
        const dataVenda = document.getElementById("dataVenda").value;
        const nomeVenda = document.getElementById("nomeVenda").value;
        const loteVenda = parseInt(document.getElementById("loteVenda").value);
        const tipoVenda = document.getElementById("tipoVenda").value;
        const precoVenda = parseFloat(document.getElementById("precoVenda").value);
        const quantidadeVenda = parseInt(document.getElementById("quantidadeVenda").value);
        const entregaVenda = document.getElementById("entregaVenda").value;
        const dataEntregaVenda = document.getElementById("dataEntregaVenda").value;
        const pagoVenda = document.getElementById("pagoVenda").value;

        const dadosBase = {
            uid: auth.currentUser.uid,
            num: num,
            dataVenda: dataVenda,
            nomeVenda: nomeVenda,
            loteVenda: loteVenda,
            tipoVenda: tipoVenda,
            precoVenda: precoVenda,
            quantidadeVenda: quantidadeVenda,
            entregaVenda: entregaVenda,
            dataEntregaVenda: dataEntregaVenda,
            totalVenda: calcularTotalVenda(precoVenda, quantidadeVenda),
            pagoVenda: pagoVenda,
        };

        if (indiceEmEdicaoVenda === null) {
            await addDoc(collection(db, "vendas"), { ...dadosBase, data: dataVenda });
        } else {
            const idDocumento = vendas[indiceEmEdicaoVenda].id;
            await updateDoc(doc(db, "vendas", idDocumento), { ...dadosBase, data: dataVenda });
        }

        fecharModalVenda();
    } catch (erro) {
        console.error(erro);
        alert("Não foi possível salvar. Verifique sua conexão e tente novamente.");
    } finally {
        botaoSubmit.disabled = false;
    }
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

function editarLancamentoVenda(indice) {
    const item = vendas[indice];

    document.getElementById("num").value = item.num;
    document.getElementById("dataVenda").value = item.dataVenda;
    document.getElementById("nomeVenda").value = item.nomeVenda;
    document.getElementById("loteVenda").value = item.loteVenda;
    document.getElementById("tipoVenda").value = item.tipoVenda;
    document.getElementById("precoVenda").value = item.precoVenda;
    document.getElementById("quantidadeVenda").value = item.quantidadeVenda;
    document.getElementById("entregaVenda").value = item.entregaVenda;
    document.getElementById("dataEntregaVenda").value = item.dataEntregaVenda;
    document.getElementById("pagoVenda").value = item.pagoVenda || "Não";

    indiceEmEdicaoVenda = indice;
    formVenda.querySelector("button[type=submit]").textContent = "Salvar alteração";
    abrirModalVenda("Editar Lançamento", false);
}

/* ---------- Exclusão individual ---------- */
async function excluirLancamento(indice) {
    const confirmar = confirm("Tem certeza que deseja excluir este lançamento?");

    if (!confirmar) return;

    const idDocumento = compras[indice].id;
    await deleteDoc(doc(db, "compras", idDocumento));
    // Não precisa chamar renderizar() aqui: o onSnapshot detecta a
    // exclusão no Firestore e atualiza a tela sozinho
    selecionados.delete(idDocumento);
    renderizar();
}

async function excluirLancamentoVenda(indice) {
    const confirmar = confirm("Tem certeza que deseja excluir este lançamento?");

    if (!confirmar) return;

    const idDocumento = vendas[indice].id;
    await deleteDoc(doc(db, "vendas", idDocumento));
    // Não precisa chamar renderizar() aqui: o onSnapshot detecta a
    // exclusão no Firestore e atualiza a tela sozinho
    selecionadosVenda.delete(idDocumento);
    renderizarVendas();
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
        celulaDataEntrega.textContent = item.dataEntrega ? formatarData(item.dataEntrega) : "-";

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

function renderizarVendas() {
    listaVendas.innerHTML = "";

    // --- Valores atuais dos filtros ---
    const dataInicioVenda = filtroDataInicioVenda.value
    const dataFimVenda = filtroDataFimVenda.value
    const tipoVenda = filtroTipoVenda.value
    const entregaVenda = filtroEntregaVenda.value
    const pagoVenda = filtroPagoVenda.value;

    // --- Filtra e ordena (mais recente primeiro) ---
    const lancamentosFiltradosVenda = vendas.filter(function (item) {
        const passaDataInicioVenda = dataInicioVenda === "" || item.dataVenda >= dataInicioVenda;
        const passaDataFimVenda = dataFimVenda === "" || item.dataVenda <= dataFimVenda;
        const passaEntregaVenda = entregaVenda === "" || item.entregaVenda === entregaVenda;
        const passaTipoVenda = tipoVenda === "" || item.tipoVenda === tipoVenda;
        const passaPagoVenda = pagoVenda === "" || (item.pagoVenda || "Não") === pagoVenda;
        return passaDataInicioVenda && passaDataFimVenda && passaEntregaVenda && passaTipoVenda && passaPagoVenda;
    }).sort(function (a, b) {
        return b.dataVenda.localeCompare(a.dataVenda);
    });

    // --- Paginação: calcula o total de páginas e o recorte da página atual ---
    const totalPaginasVenda = Math.max(1, Math.ceil(lancamentosFiltradosVenda.length / itensPorPaginaVenda));

    // Evita ficar numa página que deixou de existir (ex: filtro reduziu o total)
    if (paginaAtualVenda > totalPaginasVenda) {
        paginaAtualVenda = totalPaginasVenda;
    }

    const inicio = (paginaAtualVenda - 1) * itensPorPaginaVenda;
    const fim = inicio + itensPorPaginaVenda;
    const lancamentosDaPaginaVenda = lancamentosFiltradosVenda.slice(inicio, fim);

    textoPaginaVenda.textContent = "Página " + paginaAtualVenda + " de " + totalPaginasVenda;
    botaoPaginaAnteriorVenda.disabled = paginaAtualVenda === 1;
    botaoPaginaProximaVenda.disabled = paginaAtualVenda === totalPaginasVenda;

    // --- Desenha uma linha <tr> para cada item da página ---
    lancamentosDaPaginaVenda.forEach(function (item) {
        const linha = document.createElement("tr");

        // Checkbox de seleção: nasce marcado/desmarcado consultando o
        // Set "selecionados" — ele é sempre a fonte da verdade, não o DOM
        const celulaSelecionar = document.createElement("td");
        const checkboxLinha = document.createElement("input");
        checkboxLinha.type = "checkbox";
        checkboxLinha.checked = selecionadosVenda.has(item.id);
        checkboxLinha.addEventListener("change", function () {
            if (checkboxLinha.checked) {
                selecionadosVenda.add(item.id);
            } else {
                selecionadosVenda.delete(item.id);
            }
            atualizarBarraSelecaoVenda();
        });
        celulaSelecionar.appendChild(checkboxLinha);

        // Células de dados da venda
        const celulaNum = document.createElement("td");
        celulaNum.textContent = item.num;

        const celulaDataVenda = document.createElement("td");
        celulaDataVenda.textContent = formatarData(item.dataVenda);

        const celulaNome = document.createElement("td");
        celulaNome.textContent = item.nomeVenda;

        const celulaLote = document.createElement("td");
        celulaLote.textContent = item.loteVenda;

        const celulaTipo = document.createElement("td");
        celulaTipo.textContent = item.tipoVenda

        const celulaPreco = document.createElement("td");
        celulaPreco.textContent = formatarMoeda(item.precoVenda);

        const celulaQuantidade = document.createElement("td");
        celulaQuantidade.textContent = item.quantidadeVenda;

        const celulaTotal = document.createElement("td");
        celulaTotal.textContent = formatarMoeda(item.totalVenda);

        const celulaEntrega = document.createElement("td");
        celulaEntrega.textContent = item.entregaVenda;

        const celulaDataEntrega = document.createElement("td");
        celulaDataEntrega.textContent = item.dataEntregaVenda ? formatarData(item.dataEntregaVenda) : "-";

        const celulaPago = document.createElement("td");
        const valorPago = item.pagoVenda || "Não";
        celulaPago.textContent = valorPago;
        celulaPago.className = valorPago === "Sim" ? "pago-sim" : "pago-nao";

        // Célula de ações: botões Editar e Excluir
        const celulaAcoes = document.createElement("td");
        const botaoEditar = document.createElement("button");
        botaoEditar.textContent = "Editar";
        botaoEditar.addEventListener("click", function () {
            const indiceReal = vendas.indexOf(item);
            editarLancamentoVenda(indiceReal);
        });

        const botaoExcluir = document.createElement("button");
        botaoExcluir.textContent = "Excluir";
        botaoExcluir.addEventListener("click", function () {
            const indiceReal = vendas.indexOf(item);
            excluirLancamentoVenda(indiceReal);
        });

        celulaAcoes.appendChild(botaoEditar);
        celulaAcoes.appendChild(botaoExcluir);

        // Monta a linha na ordem das colunas da tabela
        linha.appendChild(celulaSelecionar);
        linha.appendChild(celulaNum);
        linha.appendChild(celulaDataVenda);
        linha.appendChild(celulaNome);
        linha.appendChild(celulaLote);
        linha.appendChild(celulaTipo);
        linha.appendChild(celulaPreco);
        linha.appendChild(celulaQuantidade);
        linha.appendChild(celulaTotal);
        linha.appendChild(celulaEntrega);
        linha.appendChild(celulaDataEntrega);
        linha.appendChild(celulaPago);
        linha.appendChild(celulaAcoes);

        listaVendas.appendChild(linha);
    });

    // --- Atualiza a barra de seleção e o contador de total ---
    // (idsPaginaAtual precisa ser atualizado ANTES de atualizarBarraSelecao)
    idsPaginaAtualVenda = lancamentosDaPaginaVenda.map(function (item) { return item.id; });
    atualizarBarraSelecaoVenda();
    textoTotalVendas.textContent = "Total: " + lancamentosFiltradosVenda.length + " lançamento(s)";

}