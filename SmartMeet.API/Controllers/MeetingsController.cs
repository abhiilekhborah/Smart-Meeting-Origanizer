using Microsoft.AspNetCore.Mvc;
using SmartMeet.API.DTOs;
using SmartMeet.API.Services;
namespace SmartMeet.API.Controllers;

[ApiController, Route("api/meetings")]
public class MeetingsController(IMeetingService meetings, SessionService sessions) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List() => Ok(await meetings.List());
    [HttpGet("{id:int}")] public async Task<IActionResult> Get(int id) => Ok(await meetings.Get(id));
    [HttpPost, ProducesResponseType(typeof(CreatedMeetingResponseDto), 201)]
    public async Task<IActionResult> Create(CreateMeetingDto dto)
    {
        var result = await meetings.Create(dto);
        return CreatedAtAction(nameof(Get), new { id = result.Meeting.MeetingId }, result);
    }
    [HttpPut("{id:int}/end")] public async Task<IActionResult> End(int id) => Ok(await meetings.End(id));
    [HttpGet("{id:int}/summary"), ProducesResponseType(typeof(MeetingSummaryDto), 200)]
    public async Task<IActionResult> Summary(int id) => Ok(await meetings.Summary(id));
    [HttpPost("{id:int}/join"), ProducesResponseType(typeof(SessionResponseDto), 200)]
    public async Task<IActionResult> Join(int id, JoinMeetingDto dto) => Ok(await sessions.Join(id, dto));
    [HttpGet("{id:int}/participants"), ProducesResponseType(typeof(List<UserResponseDto>), 200)]
    public async Task<IActionResult> Participants(int id) => Ok(await sessions.Participants(id));
}
