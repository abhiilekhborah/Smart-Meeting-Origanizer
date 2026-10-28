using Microsoft.AspNetCore.Mvc;
using CAPS_ai.API.DTOs;
using CAPS_ai.API.Services;
namespace CAPS_ai.API.Controllers;

[ApiController, Route("api/questions")]
public class QuestionsController(IQuestionService questions) : ControllerBase
{
    [HttpPost, ProducesResponseType(typeof(QuestionResponseDto), 201)]
    public async Task<IActionResult> Create(CreateQuestionDto dto)
    {
        var q = await questions.Create(dto);
        return Created($"/api/questions/meeting/{q.MeetingId}", q);
    }
    [HttpGet("meeting/{id:int}")] public async Task<IActionResult> List(int id) => Ok(await questions.List(id));
    [HttpGet("meeting/{id:int}/pending")] public async Task<IActionResult> Pending(int id) => Ok(await questions.List(id, "Pending"));
    [HttpGet("meeting/{id:int}/answered")] public async Task<IActionResult> Answered(int id) => Ok(await questions.List(id, "Answered"));
    [HttpGet("meeting/{id:int}/speaking")] public async Task<IActionResult> Speaking(int id)
    {
        var q = (await questions.List(id, "Speaking")).SingleOrDefault();
        return q is null ? NoContent() : Ok(q);
    }
    [HttpPut("meeting/{id:int}/next")] public async Task<IActionResult> Next(int id) => Ok(await questions.Next(id));
    [HttpPut("{id:int}/answer")] public async Task<IActionResult> Answer(int id) => Ok(await questions.Answer(id));
    [HttpPost("{id:int}/withdraw")] public async Task<IActionResult> Withdraw(int id, WithdrawQuestionDto dto) => Ok(await questions.Withdraw(id, dto));
    [HttpPut("{id:int}/note")] public async Task<IActionResult> Note(int id, OrganizerNoteDto dto) => Ok(await questions.Note(id, dto));
}
